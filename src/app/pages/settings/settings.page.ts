import { Component } from '@angular/core';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { ScanService } from '../../services/scan.service';
import { VegetableReferenceService } from '../../services/vegetable-reference.service';
import { KategoriSayuran, KATEGORI_INFO } from '../../models/vegetable-reference.model';
import { VegetableReference } from '../../models/vegetable-reference.model';
import { PrivacyPolicyComponent } from '../../modals/privacy-policy/privacy-policy.component';
import { TermsConditionComponent } from '../../modals/terms-condition/terms-condition.component';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage {
  referensiList: VegetableReference[] = [];

  constructor(
    private scanService: ScanService,
    private vegRefService: VegetableReferenceService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
  ) {}

  async ionViewWillEnter() {
    this.referensiList = this.vegRefService.getAllReferences();
  }

  getKategoriInfo(kategori: any) {
    return KATEGORI_INFO[kategori as KategoriSayuran] || null;
  }

  async bukaPrivacyPolicy() {
    await Browser.open({
      url: 'https://cynthia6662285.github.io/smartveg-legal/',
      toolbarColor: '#3d6b47'
    });
  }

  async bukaTermsCondition() {
    await Browser.open({
      url: 'https://cynthia6662285.github.io/smartveg-legal/',
      toolbarColor: '#3d6b47'
    });
  }

  // ===== HAPUS SEMUA RIWAYAT =====
  async hapusSemuaRiwayat() {
    const alert = await this.alertCtrl.create({
      header: 'Hapus Semua Riwayat',
      message: 'Semua riwayat scan akan dihapus permanen. Lanjutkan?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Hapus Semua',
          role: 'destructive',
          handler: async () => {
            try {
              const history = await this.scanService.getScanHistory();
              for (const item of history) {
                if (item.id) await this.scanService.deleteScanResult(item.id);
              }
              const toast = await this.toastCtrl.create({
                message: 'Semua riwayat berhasil dihapus',
                duration: 2000,
                color: 'success',
                position: 'top'
              });
              await toast.present();
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ===== TENTANG APLIKASI =====
  async tampilkanTentang() {
    const alert = await this.alertCtrl.create({
      header: 'Tentang Aplikasi',
      message: `Smart Veg Freshness\nVersi 1.0.0\n\nAplikasi deteksi kesegaran sayuran berbasis analisis visual rule-based.\n\nMenggunakan parameter brightness dan dominasi warna untuk menentukan kelayakan konsumsi sayuran.`,
      cssClass: 'tips-alert',
      buttons: ['Tutup']
    });
    await alert.present();
  }
}