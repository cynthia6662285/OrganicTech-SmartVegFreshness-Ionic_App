import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ScanService } from '../../services/scan.service';
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

  constructor(
    private route: ActivatedRoute,
    private scanService: ScanService,
    private vegRefService: VegetableReferenceService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['kategori']) {
        const kat = params['kategori'];
        if (kat === 'tips') {
          this.step = 'pilih-kategori';
          setTimeout(() => this.tampilkanTips(), 300);
        } else {
          this.pilihKategori(kat as KategoriSayuran);
        }
      }
    });
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

      if (!image.base64String) {
        throw new Error('Gambar tidak berhasil diambil');
      }

      // Buat data URL lengkap
      const imageBase64 = `data:image/jpeg;base64,${image.base64String}`;

      // Cek pencahayaan
      const brightness = await this.scanService.cekPencahayaan(imageBase64);
      console.log('[ScanPage] Brightness:', brightness);

      if (brightness < 40) {
        const lanjut = await this.showLightingWarning(brightness);
        if (!lanjut) return;
      }

      // Langsung proses tanpa kompres dulu — kompres bisa gagal di Android
      await this.processAnalysis(imageBase64);

    } catch (error: any) {
      console.error('[ScanPage] Camera error:', error);

      // Abaikan cancel
      const msg = String(error?.message || error?.errorMessage || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('no image')) {
        return;
      }

      await this.showToast('Kamera error: ' + (error?.message || 'Coba lagi'), 'danger');
    }
  }

  private async showLightingWarning(brightness: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: '⚠️ Pencahayaan Kurang',
        message: `Kecerahan terdeteksi rendah (${Math.round(brightness)}/255).\n\nSaran:\n• Aktifkan flash kamera\n• Pindah ke tempat lebih terang\n• Dekatkan ke sumber cahaya`,
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

      // Simpan hasil scan lengkap ke Firestore
      const docId = await this.scanService.saveScanResult({
        image: imageBase64,
        status: result.status,
        freshness_percentage: result.freshness_percentage,
        brightness_value: result.brightness_value,
        green_dominance: result.green_dominance,
        red_dominance: result.red_dominance,
        warm_dominance: result.warm_dominance,
        kategori: result.kategori,
        nama_kategori: result.nama_kategori,
        alasan: result.alasan,
        scanned_at: new Date()
      });

      await loading.dismiss();

      const toast = await this.toastCtrl.create({
        message: `Tersimpan! ID: ${docId}`,
        duration: 4000,
        color: 'success',
        position: 'top'
      });
      await toast.present();

      await this.presentResult(result);

    } catch (err: any) {
      await loading.dismiss();
      console.error('[DEBUG] Error:', err);

      const toast = await this.toastCtrl.create({
        message: 'ERROR: ' + (err?.message || JSON.stringify(err)),
        duration: 6000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

  async presentResult(res: any) {
    const isLayak = res.status === 'Layak';
    const alert = await this.alertCtrl.create({
      header: isLayak ? '✅ Sayuran Layak Konsumsi' : '❌ Sayuran Tidak Layak',
      subHeader: `Kategori: ${res.nama_kategori}`,
      message: `Tingkat Kesegaran: ${res.freshness_percentage}%\nKecerahan: ${res.brightness_value}\nDominasi Hijau: ${res.green_dominance}%\nDominasi Merah: ${res.red_dominance}%\nDominasi Hangat: ${res.warm_dominance}%\n\nKeterangan: ${res.alasan}`,
      cssClass: 'result-alert',
      buttons: [
        {
          text: 'Scan Lagi',
          handler: () => this.takePicture()
        },
        { text: 'Tutup', role: 'cancel' }
      ]
    });
    await alert.present();
  }

  async tampilkanTips() {
    const alert = await this.alertCtrl.create({
      header: '🥦 Tips Memilih Sayuran Segar',
      message: `1. Perhatikan Warna\nSayuran segar berwarna cerah dan merata. Hindari yang pucat atau kekuningan.\n\n2. Cek Tekstur\nSayuran segar terasa padat dan keras. Hindari yang lembek atau layu.\n\n3. Perhatikan Daun\nDaun harus tegak dan tidak layu. Hindari yang berlubang atau berbintik.\n\n4. Cium Aromanya\nSayuran segar beraroma alami, bukan bau busuk.\n\n5. Pilih yang Berat\nSayuran segar terasa lebih berat dari ukurannya.`,
      cssClass: 'tips-alert',
      buttons: ['Mengerti']
    });
    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}