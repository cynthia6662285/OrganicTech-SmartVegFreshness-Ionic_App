export interface VegetableReference {
  id?: string;
  nama_sayuran: string;
  kategori: KategoriSayuran;
  min_brightness: number;
  max_brightness: number;
  min_green: number;
  max_green: number;
  min_red: number;
  max_red: number;
  min_warm: number;
  max_warm: number;
  deskripsi: string;
  parameter_utama: 'green' | 'red' | 'warm' | 'brightness';
}

export type KategoriSayuran =
  | 'sayuran-hijau'
  | 'sayuran-buah'
  | 'umbi-umbian'
  | 'sayuran-berlapis'
  | 'sayuran-polong';

export const KATEGORI_INFO: Record<KategoriSayuran, { label: string; icon: string; contoh: string; warna: string }> = {
  'sayuran-hijau': {
    label: 'Sayuran Hijau',
    icon: 'leaf-outline',
    contoh: 'Bayam, kangkung, sawi, brokoli, selada',
    warna: '#3d6b47'
  },
  'sayuran-buah': {
    label: 'Sayuran Buah',
    icon: 'nutrition-outline',
    contoh: 'Tomat, cabai, terong, paprika',
    warna: '#c0392b'
  },
  'umbi-umbian': {
    label: 'Umbi-umbian',
    icon: 'ellipse-outline',
    contoh: 'Wortel, kentang, ubi',
    warna: '#e67e22'
  },
  'sayuran-berlapis': {
    label: 'Sayuran Berlapis',
    icon: 'layers-outline',
    contoh: 'Kol, kubis, bawang',
    warna: '#27ae60'
  },
  'sayuran-polong': {
    label: 'Sayuran Polong',
    icon: 'git-branch-outline',
    contoh: 'Buncis, kacang panjang',
    warna: '#2ecc71'
  },
};