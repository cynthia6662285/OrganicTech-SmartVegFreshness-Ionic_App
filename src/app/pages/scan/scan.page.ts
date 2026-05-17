import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ScanService } from '../../services/scan.service';
import { MlDetectionService } from '../../services/ml-detection.service';
import { VegetableReferenceService } from '../../services/vegetable-reference.service';
import { KategoriSayuran, KATEGORI_INFO } from '../../models/vegetable-reference.model';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: false,
})
export class ScanPage implements OnInit {
  step: 'pilih-kategori' | 'siap-scan' = 'pilih-kategori';
  kategoriDipilih: KategoriSayuran | null = null;
  kategoriInfo = KATEGORI_INFO;
  kategoriList = Object.keys(KATEGORI_INFO) as KategoriSayuran[];
  isModelReady = false;

  constructor(
    private route: ActivatedRoute,
    private scanService: ScanService,
    private mlService: MlDetectionService,
    private vegRefService: VegetableReferenceService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  async ngOnInit() {
    // Load ML model di background
    this.loadMLModel();

    this.route.queryParams.subscribe(params => {
      if (params['kategori']) {
        const kat = params['kategori'];
        if (kat === 'tips') {
          setTimeout(() => this.tampilkanTips(), 300);
        } else {
          this.pilihKategori(kat as KategoriSayuran);
        }
      }
    });
  }

  async loadMLModel() {
    try {
      await this.mlService.loadModel();
      this.isModelReady = true;
      console.log('[ScanPage] ML Model siap');
    } catch (e) {
      console.warn('[ScanPage] ML Model gagal load, akan pakai fallback');
      this.isModelReady = false;
    }
  }

  pilihKategori(kategori: KategoriSayuran) {
    this.kategoriDipilih = kategori;
    this.step = 'siap-scan';
  }

  gantiKategori() {
    this.kategoriDipilih = null;
    this.step = 'pilih-kategori';
  }

  async takePicture() {
    if (!this.kategoriDipilih) return;

    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      if (!image.base64String) return;

      const imageBase64 = `data:image/jpeg;base64,${image.base64String}`;

      // Cek pencahayaan
      const brightness = await this.scanService.cekPencahayaan(imageBase64);
      if (brightness < 40) {
        const lanjut = await this.showLightingWarning(brightness);
        if (!lanjut) return;
      }

      await this.processAnalysis(imageBase64);

    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('dismiss')) return;
      await this.showToast('Kamera error. Coba lagi.', 'danger');
    }
  }

  private async showLightingWarning(brightness: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: '⚠️ Pencahayaan Kurang',
        message: `Kecerahan rendah (${Math.round(brightness)}/255).\n\n• Aktifkan flash kamera\n• Pindah ke tempat lebih terang`,
        cssClass: 'tips-alert',
        buttons: [
          { text: 'Ulangi', role: 'cancel', handler: () => resolve(false) },
          { text: 'Lanjutkan', handler: () => resolve(true) }
        ]
      });
      await alert.present();
    });
  }

  async processAnalysis(imageBase64: string) {
    if (!this.kategoriDipilih) return;

    const loading = await this.loadingCtrl.create({
      message: 'Menganalisis sayuran...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const result = await this.scanService.analyzeImage(
        imageBase64,
        this.kategoriDipilih
      );

      // Hanya simpan jika lolos deteksi sayuran (Layak atau Tidak Layak)
      // Simpan hasil scan
    try {
      const docId = await this.scanService.saveScanResult({
        userId: '',
        image: imageBase64,
        status: result.status,
        freshness_percentage: result.freshness_percentage || 0,
        brightness_value: result.brightness_value || 0,
        green_dominance: result.green_dominance || 0,
        red_dominance: result.red_dominance || 0,
        warm_dominance: result.warm_dominance || 0,
        kategori: result.kategori,
        nama_kategori: result.nama_kategori || '',
        detected_label: result.detected_label || '',
        ml_confidence: result.ml_confidence || 0,
        alasan: result.alasan || '',
        scanned_at: new Date()
      });
      console.log('[Scan] Tersimpan:', docId);
    } catch (saveErr: any) {
      console.error('[Scan] Gagal simpan:', saveErr?.message);
      // Tampilkan error simpan ke user
      const toast = await this.toastCtrl.create({
        message: 'Peringatan: Hasil tidak tersimpan — ' + (saveErr?.message || 'cek koneksi internet'),
        duration: 4000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();
    }

      await loading.dismiss();
      await this.presentResult(result);

    } catch (err: any) {
      await loading.dismiss();
      console.error('[Scan] Error:', err);

      // BUKAN_SAYURAN — TIDAK disimpan ke Firebase
      if (err?.type === 'BUKAN_SAYURAN') {
        const alert = await this.alertCtrl.create({
          header: '🚫 Bukan Sayuran',
          message: err.message,
          cssClass: 'tips-alert',
          buttons: [
            { text: 'Coba Lagi', handler: () => this.takePicture() },
            { text: 'Tutup', role: 'cancel' }
          ]
        });
        await alert.present();
      } else {
        await this.showToast(err?.message || 'Gagal menganalisis. Coba lagi.', 'danger');
      }
    }
  }

  async presentResult(res: any) {
    const isLayak = res.status === 'Layak';
    const mlInfo = res.ml_confidence > 0
      ? `\nTerdeteksi ML: ${res.detected_label} (${res.ml_confidence}%)`
      : '';

    const alert = await this.alertCtrl.create({
      header: isLayak ? '✅ Sayuran Layak Konsumsi' : '❌ Sayuran Tidak Layak',
      subHeader: `Kategori: ${res.nama_kategori}`,
      message: `Tingkat Kesegaran: ${res.freshness_percentage}%\nKecerahan: ${res.brightness_value}\nDominasi Hijau: ${res.green_dominance}%\nDominasi Merah: ${res.red_dominance}%\nDominasi Hangat: ${res.warm_dominance}%${mlInfo}\n\nKeterangan: ${res.alasan}`,
      cssClass: 'result-alert',
      buttons: [
        { text: 'Scan Lagi', handler: () => this.takePicture() },
        { text: 'Tutup', role: 'cancel' }
      ]
    });
    await alert.present();
  }

  async tampilkanTips() {
    const alert = await this.alertCtrl.create({
      header: '🥦 Tips Memilih Sayuran Segar',
      message: `1. Perhatikan Warna\nSayuran segar berwarna cerah dan merata.\n\n2. Cek Tekstur\nSayuran segar terasa padat dan keras.\n\n3. Perhatikan Daun\nDaun harus tegak dan tidak layu.\n\n4. Cium Aromanya\nSayuran segar beraroma alami.\n\n5. Pilih yang Berat\nSayuran segar lebih berat dari ukurannya.`,
      cssClass: 'tips-alert',
      buttons: ['Mengerti']
    });
    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 4000, color, position: 'top'
    });
    await toast.present();
  }
}