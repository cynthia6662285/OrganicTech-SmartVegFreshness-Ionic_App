import { Injectable } from '@angular/core';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { environment } from '../../environments/environment';
import { ScanResult } from '../models/scan-result.model';
import { VegetableReference, KategoriSayuran, KATEGORI_INFO } from '../models/vegetable-reference.model';
import { VegetableReferenceService } from './vegetable-reference.service';
import { MlDetectionService } from './ml-detection.service';
import { DeviceService } from './device.service';

export interface AnalysisParams {
  brightness: number;
  green_dominance: number;
  red_dominance: number;
  warm_dominance: number;
  organic_score: number;
  color_variety: number;
}

export interface AnalysisResult {
  status: 'Layak' | 'Tidak Layak';
  freshness_percentage: number;
  brightness_value: number;
  green_dominance: number;
  red_dominance: number;
  warm_dominance: number;
  kategori: KategoriSayuran;
  nama_kategori: string;
  detected_label: string;
  ml_confidence: number;
  alasan: string;
}

@Injectable({ providedIn: 'root' })
export class ScanService {

  private initFirebase() {
    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(environment.firebase);
        console.log('[Firebase] Initialized manually');
      }
    } catch (e) {
      console.error('[Firebase] Init error:', e);
    }
  }

  private get db() {
    this.initFirebase();
    return firebase.firestore();
  }

  constructor(
    private vegRefService: VegetableReferenceService,
    private mlService: MlDetectionService,
    private deviceService: DeviceService,
  ) {
    // Pre-load ML model di background
    this.mlService.loadModel().catch(e =>
      console.warn('[ScanService] ML model tidak ter-load:', e)
    );
  }

  // ===== EKSTRAKSI PARAMETER VISUAL =====
  private ekstrakParameter(imageBase64: string, size = 80): Promise<AnalysisParams> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas tidak tersedia')); return; }

          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          const totalPixels = size * size;

          let totalBrightness = 0;
          let greenPixels = 0;
          let redPixels = 0;
          let warmPixels = 0;
          const hueSet = new Set<number>();
          let organicPixels = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];

            totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;

            if (g > r && g > b && g > 30) greenPixels++;
            if (r > g && r > b && r > 30) redPixels++;
            if (r > 70 && g > 30 && b < 120 && r >= g) warmPixels++;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;

            if (delta > 15 && max > 30) {
              let hue = 0;
              if (max === r) hue = ((g - b) / delta) % 6;
              else if (max === g) hue = (b - r) / delta + 2;
              else hue = (r - g) / delta + 4;
              hueSet.add(Math.round(hue * 30));
              organicPixels++;
            }
          }

          resolve({
            brightness: Math.round(totalBrightness / totalPixels),
            green_dominance: Math.round((greenPixels / totalPixels) * 100),
            red_dominance: Math.round((redPixels / totalPixels) * 100),
            warm_dominance: Math.round((warmPixels / totalPixels) * 100),
            organic_score: Math.round((organicPixels / totalPixels) * 100),
            color_variety: hueSet.size,
          });
        } catch (err) {
          reject(new Error('Gagal membaca piksel gambar'));
        }
      };

      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = imageBase64;
    });
  }

  // ===== CEK PENCAHAYAAN =====
  async cekPencahayaan(imageBase64: string): Promise<number> {
    try {
      const params = await this.ekstrakParameter(imageBase64, 50);
      return params.brightness;
    } catch {
      return 128;
    }
  }

  // ===== PIPELINE UTAMA: ML + QUALITY ANALYSIS =====
  async analyzeImage(imageBase64: string, kategori: KategoriSayuran): Promise<AnalysisResult> {

    // === TAHAP 1: ML GATE — WAJIB LOLOS ===
    console.log('[Pipeline] Tahap 1: ML Gate...');
    const detection = await this.mlService.detectSayuran(imageBase64);
    console.log('[Pipeline] Hasil ML:', detection);

    // HARD GATE — jika bukan sayuran langsung stop
    if (!detection.isSayuran) {
      throw {
        type: 'BUKAN_SAYURAN',
        message: detection.alasan
      };
    }

    // === TAHAP 2: PARAMETER VISUAL ===
    console.log('[Pipeline] Tahap 2: Parameter visual...');
    const params = await this.ekstrakParameter(imageBase64);

    if (params.brightness < 15) {
      throw {
        type: 'BUKAN_SAYURAN',
        message: 'Gambar terlalu gelap. Aktifkan flash atau pindah ke tempat terang.'
      };
    }

    // TAMBAHAN: filter non-organik berdasarkan warna
    if (params.green_dominance < 3 &&
        params.red_dominance < 3 &&
        params.warm_dominance < 3 &&
        params.organic_score < 10) {
      throw {
        type: 'BUKAN_SAYURAN',
        message: 'Warna objek tidak sesuai dengan sayuran.\n\nArahkan kamera langsung ke sayuran.'
      };
    }

    // === TAHAP 3: ANALISIS KUALITAS ===
    console.log('[Pipeline] Tahap 3: Analisis kualitas...');
    const threshold = this.vegRefService.getThresholdByKategori(kategori);
    if (!threshold) throw new Error('Data referensi tidak ditemukan');

    const kualitas = this.analisisKualitas(params, threshold, kategori);

    return {
      ...kualitas,
      brightness_value: params.brightness,
      green_dominance: params.green_dominance,
      red_dominance: params.red_dominance,
      warm_dominance: params.warm_dominance,
      kategori,
      nama_kategori: KATEGORI_INFO[kategori].label,
      detected_label: detection.label,
      ml_confidence: detection.confidence,
    };
  }

  // ===== ANALISIS KUALITAS PER KATEGORI =====
  private hitungFreshness(nilai: number, min: number, max: number): number {
    if (nilai >= min && nilai <= max) {
      const tengah = (min + max) / 2;
      const jarak = (max - min) / 2;
      const deviasi = Math.abs(nilai - tengah);
      return Math.round(100 - (deviasi / Math.max(jarak, 1)) * 30);
    }
    if (nilai < min) return Math.max(0, Math.round((nilai / Math.max(min, 1)) * 70));
    return Math.max(0, Math.round((max / Math.max(nilai, 1)) * 70));
  }

  private analisisKualitas(
    params: AnalysisParams,
    threshold: VegetableReference,
    kategori: KategoriSayuran
  ): { status: 'Layak' | 'Tidak Layak'; freshness_percentage: number; alasan: string } {

    const { brightness, green_dominance, red_dominance, warm_dominance } = params;
    let freshness_percentage = 0;
    let isLayak = false;
    let alasan = '';

    switch (kategori) {
      case 'sayuran-hijau': {
        const gScore = this.hitungFreshness(green_dominance, threshold.min_green, threshold.max_green);
        const bScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((gScore * 0.65) + (bScore * 0.35));
        isLayak = green_dominance >= threshold.min_green && brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Sayuran hijau segar. Hijau: ${green_dominance}%, kecerahan: ${brightness}.`
          : `Warna hijau kurang (${green_dominance}%) atau kecerahan rendah (${brightness}).`;
        break;
      }
      case 'sayuran-buah': {
        const rScore = this.hitungFreshness(red_dominance, threshold.min_red, threshold.max_red);
        const wScore = this.hitungFreshness(warm_dominance, threshold.min_warm, threshold.max_warm);
        const bScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((rScore * 0.40) + (wScore * 0.30) + (bScore * 0.30));
        isLayak = (red_dominance >= threshold.min_red || warm_dominance >= threshold.min_warm || green_dominance >= 10)
          && brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Sayuran buah normal. Merah: ${red_dominance}%, hangat: ${warm_dominance}%.`
          : `Warna kurang sesuai. Merah: ${red_dominance}%, hangat: ${warm_dominance}%.`;
        break;
      }
      case 'umbi-umbian': {
        const wScore = this.hitungFreshness(warm_dominance, threshold.min_warm, threshold.max_warm);
        const rScore = this.hitungFreshness(red_dominance, threshold.min_red, threshold.max_red);
        const bScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((wScore * 0.45) + (rScore * 0.25) + (bScore * 0.30));
        isLayak = (warm_dominance >= threshold.min_warm || red_dominance >= threshold.min_red)
          && brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Umbi segar. Hangat: ${warm_dominance}%, kecerahan: ${brightness}.`
          : `Warna umbi tidak sesuai. Hangat: ${warm_dominance}%, kecerahan: ${brightness}.`;
        break;
      }
      case 'sayuran-berlapis': {
        const bScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        const gScore = this.hitungFreshness(green_dominance, threshold.min_green, threshold.max_green);
        freshness_percentage = Math.round((bScore * 0.65) + (gScore * 0.35));
        isLayak = brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Sayuran berlapis normal. Kecerahan: ${brightness}.`
          : `Kecerahan kurang (${brightness}). Sayuran mungkin layu.`;
        break;
      }
      case 'sayuran-polong': {
        const gScore = this.hitungFreshness(green_dominance, threshold.min_green, threshold.max_green);
        const bScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((gScore * 0.60) + (bScore * 0.40));
        isLayak = green_dominance >= threshold.min_green && brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Sayuran polong segar. Hijau: ${green_dominance}%, kecerahan: ${brightness}.`
          : `Warna hijau kurang (${green_dominance}%). Mungkin sudah menguning.`;
        break;
      }
      default: {
        freshness_percentage = Math.min(brightness, 100);
        isLayak = brightness > 50;
        alasan = `Analisis umum. Kecerahan: ${brightness}.`;
      }
    }

    return {
      status: isLayak ? 'Layak' : 'Tidak Layak',
      freshness_percentage: Math.min(Math.max(freshness_percentage, 0), 100),
      alasan,
    };
  }

  // ===== BUAT THUMBNAIL =====
  makeThumbnail(base64: string, size = 120, quality = 0.6): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas error')); return; }
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Gagal buat thumbnail'));
      img.src = base64;
    });
  }

  // ===== SIMPAN HASIL SCAN — dengan deviceId =====
  // ===== SIMPAN HASIL SCAN =====
  async saveScanResult(result: Omit<ScanResult, 'id'>): Promise<string> {
    try {
      const deviceId = await this.deviceService.getDeviceId();
      console.log('[Save] Device ID:', deviceId);

      let imageToSave = '';
      try {
        imageToSave = await this.makeThumbnail(result.image, 120, 0.6);
      } catch {
        imageToSave = '';
      }

      // Bersihkan semua nilai undefined/null
      // Firebase akan reject jika ada field undefined
      const dataToSave: { [key: string]: any } = {
        userId: deviceId || 'unknown',
        image: imageToSave || '',
        status: result.status || 'Tidak Layak',
        freshness_percentage: result.freshness_percentage || 0,
        brightness_value: result.brightness_value || 0,
        green_dominance: result.green_dominance || 0,
        red_dominance: result.red_dominance || 0,
        warm_dominance: result.warm_dominance || 0,
        kategori: result.kategori || 'sayuran-hijau',
        nama_kategori: result.nama_kategori || '',
        detected_label: result.detected_label || '',
        ml_confidence: result.ml_confidence || 0,
        alasan: result.alasan || '',
        scanned_at: firebase.firestore.Timestamp.now(),
      };

      // Hapus field yang masih undefined atau null
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined || dataToSave[key] === null) {
          delete dataToSave[key];
        }
      });

      console.log('[Save] Data yang akan disimpan:', {
        ...dataToSave,
        image: dataToSave['image'] ? `[${Math.round(dataToSave['image'].length / 1024)}KB]` : 'kosong'
      });

      const docRef = await this.db.collection('scan_results').add(dataToSave);
      console.log('[Save] BERHASIL! ID:', docRef.id);
      return docRef.id;

    } catch (error: any) {
      console.error('[Save] GAGAL:', error?.code, error?.message);
      throw new Error('Gagal menyimpan: ' + (error?.message || 'Unknown'));
    }
  }

  // ===== AMBIL RIWAYAT — filter per deviceId =====
  async getScanHistory(): Promise<ScanResult[]> {
    try {
      const deviceId = await this.deviceService.getDeviceId();
      console.log('[History] Device ID:', deviceId);

      const snapshot = await this.db
        .collection('scan_results')
        .where('userId', '==', deviceId)
        .get();

      console.log('[History] Jumlah data:', snapshot.docs.length);

      const results = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ScanResult));

      return results.sort((a, b) => {
        const toMs = (v: any) => {
          if (!v) return 0;
          if (v.toDate) return v.toDate().getTime();
          if (v.seconds) return v.seconds * 1000;
          return new Date(v).getTime();
        };
        return toMs(b.scanned_at) - toMs(a.scanned_at);
      });

    } catch (error: any) {
      console.error('[History] Gagal:', error?.message);
      return [];
    }
  }
  // ===== HAPUS SCAN =====
  async deleteScanResult(id: string): Promise<void> {
    await this.db.collection('scan_results').doc(id).delete();
  }
}