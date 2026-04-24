import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ScanService } from '../../services/scan.service';
import { ScanResult } from '../../models/scan-result.model';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: false,
})
export class HistoryPage {
  riwayat: ScanResult[] = [];
  riwayatFilter: ScanResult[] = [];
  isLoading: boolean = true;
  searchQuery: string = '';
  totalScan: number = 0;
  rataRataKesegaran: number = 0;

  constructor(
    private scanService: ScanService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  async ionViewWillEnter() {
    await this.loadRiwayat();
  }

  async loadRiwayat() {
    this.isLoading = true;
    try {
      this.riwayat = await this.scanService.getScanHistory();
      this.riwayatFilter = [...this.riwayat];
      this.totalScan = this.riwayat.length;
      if (this.riwayat.length > 0) {
        const total = this.riwayat.reduce((sum, h) => sum + (h.freshness_percentage || 0), 0);
        this.rataRataKesegaran = Math.round(total / this.riwayat.length);
      } else {
        this.rataRataKesegaran = 0;
      }
    } catch (error) {
      console.error('Error loading history:', error);
      this.rataRataKesegaran = 0;
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value?.toLowerCase() || '';
    this.filterRiwayat();
  }

  filterRiwayat() {
    if (!this.searchQuery) {
      this.riwayatFilter = [...this.riwayat];
      return;
    }
    const q = this.searchQuery;
    this.riwayatFilter = this.riwayat.filter(item =>
      (item.status?.toLowerCase() ?? '').includes(q) ||
      (item.nama_kategori?.toLowerCase() ?? '').includes(q) ||
      (item.alasan?.toLowerCase() ?? '').includes(q) ||
      item.freshness_percentage.toString().includes(q)
    );
  }

  async konfirmasiHapus(item: ScanResult) {
    const alert = await this.alertCtrl.create({
      header: 'Hapus Riwayat',
      message: 'Apakah kamu yakin ingin menghapus riwayat scan ini?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Hapus',
          role: 'destructive',
          handler: () => this.hapusRiwayat(item)
        }
      ]
    });
    await alert.present();
  }

  async hapusRiwayat(item: ScanResult) {
    try {
      await this.scanService.deleteScanResult(item.id!);
      this.riwayat = this.riwayat.filter(r => r.id !== item.id);
      this.riwayatFilter = this.riwayatFilter.filter(r => r.id !== item.id);
      this.totalScan = this.riwayat.length;
      const toast = await this.toastCtrl.create({
        message: 'Riwayat berhasil dihapus',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  }

  getWaktuScan(scanned_at: any): string {
    if (!scanned_at) return '';
    const date = scanned_at.toDate ? scanned_at.toDate() : new Date(scanned_at);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return `Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getStatusLabel(status: string): string {
    return status === 'Layak' ? 'SEGAR' : 'TIDAK SEGAR';
  }

  getStatusIcon(status: string): string {
    return status === 'Layak' ? 'checkmark-circle' : 'warning';
  }

  goToScan() {
    this.router.navigate(['/tabs/scan']);
  }
}