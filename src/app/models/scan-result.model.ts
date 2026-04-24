import { KategoriSayuran } from './vegetable-reference.model';

export interface ScanResult {
  id?: string;
  image: string;
  status: 'Layak' | 'Tidak Layak';
  freshness_percentage: number;
  brightness_value: number;
  green_dominance: number;
  red_dominance: number;
  warm_dominance: number;
  kategori: KategoriSayuran;
  nama_kategori: string;
  alasan: string;
  scanned_at: any;
}