import { KategoriSayuran } from './vegetable-reference.model';

export interface ScanResult {
  id?: string;
  userId: string;
  image: string;
  status: 'Layak' | 'Tidak Layak';
  freshness_percentage: number;
  brightness_value: number;
  green_dominance: number;
  red_dominance: number;
  warm_dominance: number;
  kategori: KategoriSayuran;
  nama_kategori: string;
  detected_label?: string;
  ml_confidence?: number;
  alasan?: string;
  scanned_at: any;
}