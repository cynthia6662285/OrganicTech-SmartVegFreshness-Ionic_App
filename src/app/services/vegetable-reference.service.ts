import { Injectable } from '@angular/core';
import { VegetableReference, KategoriSayuran } from '../models/vegetable-reference.model';

const REFERENCES: VegetableReference[] = [
  // SAYURAN HIJAU
  {
    id: '1', nama_sayuran: 'Sayuran Hijau Umum', kategori: 'sayuran-hijau',
    min_brightness: 40, max_brightness: 230,
    min_green: 15, max_green: 100,
    min_red: 0, max_red: 50,
    min_warm: 0, max_warm: 50,
    parameter_utama: 'green',
    deskripsi: 'Bayam, kangkung, sawi, brokoli, selada'
  },
  // SAYURAN BUAH
  {
    id: '2', nama_sayuran: 'Sayuran Buah Umum', kategori: 'sayuran-buah',
    min_brightness: 40, max_brightness: 230,
    min_green: 0, max_green: 60,
    min_red: 10, max_red: 100,
    min_warm: 5, max_warm: 100,
    parameter_utama: 'red',
    deskripsi: 'Tomat, cabai, terong, paprika'
  },
  // UMBI-UMBIAN
  {
    id: '3', nama_sayuran: 'Umbi-umbian Umum', kategori: 'umbi-umbian',
    min_brightness: 40, max_brightness: 220,
    min_green: 0, max_green: 30,
    min_red: 5, max_red: 80,
    min_warm: 10, max_warm: 100,
    parameter_utama: 'warm',
    deskripsi: 'Wortel, kentang, ubi'
  },
  // SAYURAN BERLAPIS
  {
    id: '4', nama_sayuran: 'Sayuran Berlapis Umum', kategori: 'sayuran-berlapis',
    min_brightness: 50, max_brightness: 240,
    min_green: 0, max_green: 50,
    min_red: 0, max_red: 40,
    min_warm: 0, max_warm: 40,
    parameter_utama: 'brightness',
    deskripsi: 'Kol, kubis, bawang'
  },
  // SAYURAN POLONG
  {
    id: '5', nama_sayuran: 'Sayuran Polong Umum', kategori: 'sayuran-polong',
    min_brightness: 40, max_brightness: 220,
    min_green: 12, max_green: 100,
    min_red: 0, max_red: 45,
    min_warm: 0, max_warm: 40,
    parameter_utama: 'green',
    deskripsi: 'Buncis, kacang panjang'
  },
];

@Injectable({ providedIn: 'root' })
export class VegetableReferenceService {

  // Tidak perlu constructor injection apapun
  constructor() {}

  getAllReferences(): VegetableReference[] {
    return REFERENCES;
  }

  getByKategori(kategori: KategoriSayuran): VegetableReference[] {
    return REFERENCES.filter(r => r.kategori === kategori);
  }

  getThresholdByKategori(kategori: KategoriSayuran): VegetableReference | null {
    return REFERENCES.find(r => r.kategori === kategori) || null;
  }

  // Tetap ada untuk kompatibilitas
  async ensureLoaded(): Promise<void> {
    return Promise.resolve();
  }
}