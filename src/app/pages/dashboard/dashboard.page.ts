import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ScanService } from '../../services/scan.service';
import { ScanResult } from '../../models/scan-result.model';
import { KATEGORI_INFO } from '../../models/vegetable-reference.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {
  totalScan = 0;
  layakCount = 0;
  tidakLayakCount = 0;
  rataRataKesegaran = 0;
  scanTerbaru: ScanResult | null = null;
  isLoading = true;

  kategoriList = [
    { ...KATEGORI_INFO['sayuran-hijau'], key: 'sayuran-hijau' },
    { ...KATEGORI_INFO['sayuran-buah'], key: 'sayuran-buah' },
    { ...KATEGORI_INFO['umbi-umbian'], key: 'umbi-umbian' },
    { ...KATEGORI_INFO['sayuran-berlapis'], key: 'sayuran-berlapis' },
    { ...KATEGORI_INFO['sayuran-polong'], key: 'sayuran-polong' },
    { label: 'Tips Segar', icon: 'bulb-outline', warna: '#f0a500', contoh: 'Cara memilih sayuran', key: 'tips' },
  ];

  constructor(
    private scanService: ScanService,
    public router: Router,
  ) {}

  async ngOnInit() { await this.loadData(); }
  async ionViewWillEnter() { await this.loadData(); }

  async loadData() {
    this.isLoading = true;
    try {
      const history = await this.scanService.getScanHistory();
      this.totalScan = history.length;
      this.layakCount = history.filter(h => h.status === 'Layak').length;
      this.tidakLayakCount = history.filter(h => h.status === 'Tidak Layak').length;
      this.scanTerbaru = history[0] || null;
      if (history.length > 0) {
        const total = history.reduce((s, h) => s + h.freshness_percentage, 0);
        this.rataRataKesegaran = Math.round(total / history.length);
      }
    } catch (e) {
      console.error('Error dashboard:', e);
    } finally {
      this.isLoading = false;
    }
  }

  goToScan() { this.router.navigate(['/tabs/scan']); }
  goToHistory() { this.router.navigate(['/tabs/history']); }

  goToKategori(key: string) {
    this.router.navigate(['/tabs/scan'], { queryParams: { kategori: key } });
  }

  getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }

  getDashboardStatus(): string {
    if (this.totalScan === 0) return 'Mulai Scan Pertamamu!';
    if (this.rataRataKesegaran >= 70) return 'Sayuranmu Sangat Segar!';
    if (this.rataRataKesegaran >= 40) return 'Kualitas Cukup Baik';
    return 'Perlu Perhatian Lebih';
  }

  getWaktuScan(scannedAt: any): string {
    if (!scannedAt) return '';
    const date = scannedAt.toDate ? scannedAt.toDate() : new Date(scannedAt);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return 'Baru saja';
    if (diff < 60) return `${diff} menit lalu`;
    if (diff < 1440) return `${Math.floor(diff / 60)} jam lalu`;
    return `${Math.floor(diff / 1440)} hari lalu`;
  }

  getProgressWidth(v: number): string { return `${Math.min(v, 100)}%`; }
}