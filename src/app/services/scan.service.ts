import { Injectable } from '@angular/core';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { ScanResult } from '../models/scan-result.model';
import { VegetableReference, KategoriSayuran, KATEGORI_INFO } from '../models/vegetable-reference.model';
import { VegetableReferenceService } from './vegetable-reference.service';
import { environment } from '../../environments/environment';

export interface AnalysisParams {
  brightness: number;
  green_dominance: number;
  red_dominance: number;
  warm_dominance: number;
  color_variety: number;
  organic_score: number;
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
  alasan: string;
}

@Injectable({ providedIn: 'root' })
export class ScanService {

  // Gunakan Firebase native langsung — bypass AngularFire
  private get db() {
    return firebase.firestore();
  }

  constructor(private vegRefService: VegetableReferenceService) {
    // Pastikan Firebase sudah di-initialize sebelum digunakan
    // (guard ini aman untuk dipanggil berkali-kali)
    if (!firebase.apps.length) {
      firebase.initializeApp(environment.firebase);
      console.log('[ScanService] Firebase initialized manually');
    }
  }

  // ===== 1. EKSTRAKSI PARAMETER VISUAL =====
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
          const hueMap: Set<number> = new Set();
          let organicPixels = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

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
              hueMap.add(Math.round(hue * 30));
              organicPixels++;
            }
          }

          resolve({
            brightness: Math.round(totalBrightness / totalPixels),
            green_dominance: Math.round((greenPixels / totalPixels) * 100),
            red_dominance: Math.round((redPixels / totalPixels) * 100),
            warm_dominance: Math.round((warmPixels / totalPixels) * 100),
            color_variety: hueMap.size,
            organic_score: Math.round((organicPixels / totalPixels) * 100),
          });

        } catch (err) {
          reject(new Error('Gagal membaca data piksel'));
        }
      };

      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = imageBase64;
    });
  }

  // ===== 2. CEK PENCAHAYAAN =====
  async cekPencahayaan(imageBase64: string): Promise<number> {
    try {
      const params = await this.ekstrakParameter(imageBase64, 50);
      return params.brightness;
    } catch {
      return 128;
    }
  }

  // ===== 3. VALIDASI OBJEK =====
  private validasiObjek(
    params: AnalysisParams,
    kategori: KategoriSayuran
  ): { valid: boolean; pesan: string } {
    const { brightness, green_dominance, red_dominance, warm_dominance, color_variety, organic_score } = params;

    if (brightness < 15) {
      return { valid: false, pesan: 'Gambar terlalu gelap. Aktifkan flash atau pindah ke tempat terang.' };
    }

    if (brightness > 240 && organic_score < 10) {
      return { valid: false, pesan: 'Gambar terlalu putih/polos. Arahkan kamera ke sayuran.' };
    }

    if (color_variety < 3 && organic_score < 15) {
      return {
        valid: false,
        pesan: 'Objek terdeteksi memiliki warna seragam/buatan.\n\nSistem hanya menganalisis sayuran segar. Pastikan:\n• Kamera mengarah ke sayuran\n• Sayuran mengisi sebagian besar frame\n• Pencahayaan cukup'
      };
    }

    switch (kategori) {
      case 'sayuran-hijau':
      case 'sayuran-polong':
        if (organic_score < 20) {
          return {
            valid: false,
            pesan: 'Tidak terdeteksi sebagai sayuran hijau.\n\nPastikan:\n• Yang difoto adalah bayam, kangkung, sawi, dll\n• Sayuran mengisi frame dengan jelas\n• Pencahayaan cukup terang'
          };
        }
        if (red_dominance > 60 && green_dominance < 5) {
          return {
            valid: false,
            pesan: 'Warna merah terlalu dominan untuk sayuran hijau.\n\nGunakan kategori "Sayuran Buah" untuk tomat atau cabai.'
          };
        }
        break;

      case 'sayuran-buah':
        if (organic_score < 15) {
          return {
            valid: false,
            pesan: 'Tidak terdeteksi sebagai sayuran buah.\n\nPastikan yang difoto adalah tomat, cabai, terong, atau paprika.'
          };
        }
        break;

      case 'umbi-umbian':
        if (organic_score < 12) {
          return {
            valid: false,
            pesan: 'Tidak terdeteksi sebagai umbi-umbian.\n\nPastikan yang difoto adalah wortel, kentang, atau ubi dengan pencahayaan cukup.'
          };
        }
        if (green_dominance > 65 && warm_dominance < 5 && red_dominance < 5) {
          return {
            valid: false,
            pesan: 'Warna tidak sesuai untuk umbi-umbian.\n\nWortel, kentang, dan ubi memiliki warna oranye, kuning, atau cokelat.'
          };
        }
        break;

      case 'sayuran-berlapis':
        if (organic_score < 12) {
          return {
            valid: false,
            pesan: 'Tidak terdeteksi sebagai sayuran berlapis.\n\nPastikan yang difoto adalah kol atau kubis.'
          };
        }
        break;
    }

    return { valid: true, pesan: '' };
  }

  // ===== 4. HITUNG FRESHNESS =====
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

  // ===== 5. ANALISIS UTAMA =====
  async analyzeImage(imageBase64: string, kategori: KategoriSayuran): Promise<AnalysisResult> {
    const params = await this.ekstrakParameter(imageBase64);
    console.log('[Analisis] Params:', JSON.stringify(params));

    const validasi = this.validasiObjek(params, kategori);
    if (!validasi.valid) {
      throw { type: 'BUKAN_SAYURAN', message: validasi.pesan };
    }

    const threshold = this.vegRefService.getThresholdByKategori(kategori);
    if (!threshold) throw new Error('Data referensi tidak ditemukan');

    const analisis = this.analisisBerdasarkanKategori(params, threshold, kategori);

    return {
      ...analisis,
      brightness_value: params.brightness,
      green_dominance: params.green_dominance,
      red_dominance: params.red_dominance,
      warm_dominance: params.warm_dominance,
      kategori,
      nama_kategori: KATEGORI_INFO[kategori].label,
    };
  }

  // ===== 6. LOGIKA PER KATEGORI =====
  private analisisBerdasarkanKategori(
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
        const greenScore = this.hitungFreshness(green_dominance, threshold.min_green, threshold.max_green);
        const brightnessScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((greenScore * 0.65) + (brightnessScore * 0.35));
        isLayak = green_dominance >= threshold.min_green && brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Sayuran hijau segar. Hijau: ${green_dominance}%, kecerahan: ${brightness}.`
          : `Warna hijau kurang (${green_dominance}%) atau kecerahan rendah (${brightness}).`;
        break;
      }
      case 'sayuran-buah': {
        const redScore = this.hitungFreshness(red_dominance, threshold.min_red, threshold.max_red);
        const warmScore = this.hitungFreshness(warm_dominance, threshold.min_warm, threshold.max_warm);
        const brightnessScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((redScore * 0.40) + (warmScore * 0.30) + (brightnessScore * 0.30));
        isLayak = (red_dominance >= threshold.min_red || warm_dominance >= threshold.min_warm || green_dominance >= 10)
          && brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Sayuran buah normal. Merah: ${red_dominance}%, hangat: ${warm_dominance}%.`
          : `Warna kurang sesuai. Merah: ${red_dominance}%, hangat: ${warm_dominance}%.`;
        break;
      }
      case 'umbi-umbian': {
        const warmScore = this.hitungFreshness(warm_dominance, threshold.min_warm, threshold.max_warm);
        const redScore = this.hitungFreshness(red_dominance, threshold.min_red, threshold.max_red);
        const brightnessScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((warmScore * 0.45) + (redScore * 0.25) + (brightnessScore * 0.30));
        isLayak = (warm_dominance >= threshold.min_warm || red_dominance >= threshold.min_red)
          && brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Umbi segar. Hangat: ${warm_dominance}%, kecerahan: ${brightness}.`
          : `Warna umbi kurang sesuai. Hangat: ${warm_dominance}%, kecerahan: ${brightness}.`;
        break;
      }
      case 'sayuran-berlapis': {
        const brightnessScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        const greenScore = this.hitungFreshness(green_dominance, threshold.min_green, threshold.max_green);
        freshness_percentage = Math.round((brightnessScore * 0.65) + (greenScore * 0.35));
        isLayak = brightness >= threshold.min_brightness;
        alasan = isLayak
          ? `Sayuran berlapis normal. Kecerahan: ${brightness}.`
          : `Kecerahan kurang (${brightness}). Sayuran mungkin layu.`;
        break;
      }
      case 'sayuran-polong': {
        const greenScore = this.hitungFreshness(green_dominance, threshold.min_green, threshold.max_green);
        const brightnessScore = this.hitungFreshness(brightness, threshold.min_brightness, threshold.max_brightness);
        freshness_percentage = Math.round((greenScore * 0.60) + (brightnessScore * 0.40));
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

  // ===== 7. BUAT THUMBNAIL =====
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

  // ===== 8. SIMPAN HASIL SCAN — pakai Firebase native =====
  async saveScanResult(result: Omit<ScanResult, 'id'>): Promise<string> {
    try {
      // Buat thumbnail kecil
      let imageToSave = '';
      try {
        imageToSave = await this.makeThumbnail(result.image, 120, 0.6);
        console.log('[Save] Thumbnail size:', Math.round(imageToSave.length / 1024), 'KB');
      } catch (e) {
        console.warn('[Save] Thumbnail gagal, simpan tanpa gambar');
      }

      const dataToSave = {
        ...result,
        image: imageToSave,
        scanned_at: firebase.firestore.Timestamp.fromDate(
          result.scanned_at instanceof Date ? result.scanned_at : new Date()
        ),
      };

      // Gunakan Firebase native — tidak ada masalah injection context
      const docRef = await this.db.collection('scan_results').add(dataToSave);
      console.log('[Save] Berhasil! ID:', docRef.id);
      return docRef.id;

    } catch (error: any) {
      console.error('[Save] Error:', error?.message || error);
      throw new Error('Gagal menyimpan: ' + (error?.message || 'Unknown error'));
    }
  }

  // ===== 9. AMBIL RIWAYAT — pakai Firebase native =====
  async getScanHistory(): Promise<ScanResult[]> {
    try {
      const snapshot = await this.db.collection('scan_results').get();

      const results: ScanResult[] = snapshot.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          image: data['image'] ?? '',
          status: data['status'] ?? 'Tidak Layak',
          freshness_percentage: data['freshness_percentage'] ?? 0,
          brightness_value: data['brightness_value'] ?? 0,
          green_dominance: data['green_dominance'] ?? 0,
          red_dominance: data['red_dominance'] ?? 0,
          warm_dominance: data['warm_dominance'] ?? 0,
          kategori: data['kategori'] ?? 'sayuran-hijau',
          nama_kategori: data['nama_kategori'] ?? '-',
          alasan: data['alasan'] ?? '',
          scanned_at: data['scanned_at'] ?? null,
        } as ScanResult;
      });

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
      console.error('[History] Error:', error?.message);
      return [];
    }
  }

  // ===== 10. HAPUS SCAN — pakai Firebase native =====
  async deleteScanResult(id: string): Promise<void> {
    await this.db.collection('scan_results').doc(id).delete();
  }
}