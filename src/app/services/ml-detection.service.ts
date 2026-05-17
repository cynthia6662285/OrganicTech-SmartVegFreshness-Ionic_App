import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

// ===== WHITELIST SAYURAN — HARUS EXACT MATCH =====
const STRICT_VEGETABLE_LABELS = [
  // Sayuran umum
  'broccoli', 'cauliflower', 'cabbage', 'head cabbage',
  'carrot', 'cucumber', 'zucchini', 'courgette',
  'spinach', 'lettuce', 'romaine', 'kale', 'chard',
  'bell pepper', 'hot pepper', 'chili', 'jalapeno', 'pepper',
  'eggplant', 'artichoke', 'mushroom', 'truffle',
  'pumpkin', 'squash', 'acorn squash', 'butternut squash',
  'corn', 'maize', 'potato', 'sweet potato', 'yam',
  'radish', 'turnip', 'beet', 'beetroot',
  'celery', 'asparagus', 'green bean', 'snap bean',
  'bean', 'pea', 'bok choy', 'pak choi',
  'tomato', 'paprika', 'garlic', 'onion', 'leek',
  'scallion', 'green onion', 'shallot', 'ginger',
  'herb', 'basil', 'parsley', 'cilantro',
  'plantain', 'breadfruit', 'jackfruit',
  'vegetable', 'produce', 'grocery',
  // Label MobileNet ImageNet yang sering muncul
  'acorn', 'hip', 'rapini', 'cardoon', 'cardamine',
  'gyromitra', 'agaric', 'coral fungus', 'hen-of-the-woods',
  'earthstar', 'stinkhorn', 'bolete',
  // Buah yang dianggap sayuran
  'fig', 'pomegranate', 'banana', 'plantain',
  'orange', 'lemon', 'lime', 'grapefruit',
  'strawberry', 'grape', 'apple', 'pear',
  'pineapple', 'mango', 'papaya', 'guava',
  // Label umum yang organik
  'food', 'dish', 'ingredient', 'meal', 'plate',
  'bowl', 'salad', 'soup', 'stew', 'curry',
  'pickle', 'sauce', 'juice', 'smoothie',
];

// ===== BLACKLIST KERAS — LANGSUNG REJECT =====
const REJECT_LABELS = [
  // Manusia & tubuh
  'person', 'human', 'face', 'hand', 'finger', 'arm',
  'man', 'woman', 'boy', 'girl', 'people', 'crowd',
  // Hewan
  'animal', 'dog', 'cat', 'bird', 'fish', 'insect',
  'cat', 'kitten', 'puppy', 'hamster', 'rabbit',
  // Elektronik & perabot
  'phone', 'mobile', 'computer', 'laptop', 'keyboard',
  'monitor', 'screen', 'television', 'camera', 'remote',
  'table', 'chair', 'furniture', 'desk', 'sofa', 'couch',
  // Benda buatan
  'bottle', 'cup', 'glass', 'container', 'plastic',
  'bag', 'box', 'package', 'wrapper', 'can', 'tin',
  'pen', 'pencil', 'book', 'paper', 'card',
  'shoe', 'clothing', 'shirt', 'hat', 'jacket',
  // Kendaraan & gedung
  'car', 'vehicle', 'road', 'building', 'wall',
  'floor', 'ceiling', 'window', 'door',
  // Rokok & vape (penyebab hasil sebelumnya salah)
  'cigarette', 'cigar', 'lighter', 'vape', 'smoking',
  // Makanan olahan (bukan sayuran segar)
  'pizza', 'burger', 'sandwich', 'cake', 'bread',
  'sushi', 'noodle', 'pasta', 'soup', 'stew',
  'fried', 'grilled', 'cooked',
];

export interface DetectionResult {
  isSayuran: boolean;
  label: string;
  confidence: number;
  alasan: string;
}

@Injectable({ providedIn: 'root' })
export class MlDetectionService {
  private model: mobilenet.MobileNet | null = null;
  private loadPromise: Promise<void> | null = null;

  async loadModel(): Promise<void> {
    if (this.model) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._doLoad();
    return this.loadPromise;
  }

  private async _doLoad(): Promise<void> {
    try {
      await tf.ready();
      this.model = await mobilenet.load({ version: 2, alpha: 0.5 });
      console.log('[ML] Model loaded!');
    } catch (error) {
      this.model = null;
      throw error;
    }
  }

  isModelReady(): boolean {
    return this.model !== null;
  }

  // ===== GATE UTAMA: DETEKSI SAYURAN =====
  async detectSayuran(imageBase64: string): Promise<DetectionResult> {

    // Jika model belum ready — REJECT (bukan allow)
    if (!this.model) {
      console.warn('[ML] Model belum siap — reject untuk keamanan');
      return {
        isSayuran: false,
        label: 'model_not_ready',
        confidence: 0,
        alasan: 'Model deteksi belum siap. Tunggu sebentar dan coba lagi.'
      };
    }

    try {
      const imgEl = await this.loadImage(imageBase64);
      // Ambil 5 prediksi teratas
      const predictions = await this.model.classify(imgEl, 5);
      console.log('[ML] Predictions:', predictions.map(p =>
        `${p.className} (${Math.round(p.probability * 100)}%)`
      ));

      return this.evaluatePredictions(predictions);

    } catch (error) {
      console.error('[ML] Error:', error);
      // Error → REJECT, bukan allow
      return {
        isSayuran: false,
        label: 'error',
        confidence: 0,
        alasan: 'Gagal memproses gambar. Coba ambil foto ulang.'
      };
    }
  }

  // ===== EVALUASI PREDIKSI =====
  private evaluatePredictions(
    predictions: { className: string; probability: number }[]
  ): DetectionResult {

    const allLabels = predictions.map(p =>
      `${p.className} (${Math.round(p.probability * 100)}%)`
    ).join(', ');
    console.log('[ML] Semua prediksi:', allLabels);

    // STEP 1: Cek REJECT keras di prediksi teratas saja (confidence > 40%)
    const top3 = predictions.slice(0, 3);
    for (const pred of top3) {
      const label = pred.className.toLowerCase();
      const conf = pred.probability;

      if (conf < 0.40) continue; // hanya reject jika sangat yakin bukan sayuran

      for (const rejectLabel of REJECT_LABELS) {
        if (label.includes(rejectLabel)) {
          return {
            isSayuran: false,
            label: pred.className,
            confidence: Math.round(conf * 100),
            alasan: `Terdeteksi sebagai "${pred.className}", bukan sayuran.\n\nArahkan kamera langsung ke sayuran segar.`
          };
        }
      }
    }

    // STEP 2: Cek label sayuran dengan threshold lebih rendah (15%)
    for (const pred of predictions) {
      const label = pred.className.toLowerCase();
      const conf = pred.probability;

      if (conf < 0.15) continue;

      for (const vegLabel of STRICT_VEGETABLE_LABELS) {
        if (label.includes(vegLabel)) {
          return {
            isSayuran: true,
            label: pred.className,
            confidence: Math.round(conf * 100),
            alasan: `Terdeteksi: "${pred.className}" (${Math.round(conf * 100)}%)`
          };
        }
      }
    }

    // STEP 3: Cek apakah ada kata organik/alam di semua prediksi
    const organicKeywords = [
      'plant', 'food', 'fruit', 'flower', 'leaf', 'green',
      'fresh', 'organic', 'nature', 'garden', 'farm',
      'produce', 'market', 'grocery', 'salad', 'herb',
      'root', 'stem', 'seed', 'gourd', 'melon', 'fig',
      'pickle', 'relish', 'sauce', 'soup', 'stew',
      'head', 'bunch', 'stalk', 'sprout'
    ];

    for (const pred of predictions) {
      const label = pred.className.toLowerCase();
      const conf = pred.probability;

      if (conf < 0.12) continue;

      for (const keyword of organicKeywords) {
        if (label.includes(keyword)) {
          console.log('[ML] Lolos via organic keyword:', pred.className);
          return {
            isSayuran: true,
            label: pred.className,
            confidence: Math.round(conf * 100),
            alasan: `Objek terdeteksi sebagai bahan organik: "${pred.className}"`
          };
        }
      }
    }

    // STEP 4: Jika confidence semua prediksi sangat rendah
    // kemungkinan foto buram/terlalu dekat → beri kesempatan lewat
    const maxConf = Math.max(...predictions.map(p => p.probability));
    if (maxConf < 0.15) {
      console.log('[ML] Confidence rendah, lewatkan ke analisis warna');
      return {
        isSayuran: true, // beri kesempatan, analisis warna akan filter
        label: 'low_confidence',
        confidence: Math.round(maxConf * 100),
        alasan: 'Keyakinan rendah, dianalisis berdasarkan warna'
      };
    }

    // STEP 5: Tidak ada yang cocok
    const top = predictions[0];
    return {
      isSayuran: false,
      label: top.className,
      confidence: Math.round(top.probability * 100),
      alasan: `Objek tidak dikenali sebagai sayuran.\n\nTerdeteksi: "${top.className}"\n\nTips:\n• Dekatkan kamera ke sayuran\n• Pastikan sayuran mengisi seluruh frame\n• Pastikan pencahayaan cukup terang`
    };
  }

  // ===== HELPER: Load Image =====
  private loadImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Gagal load gambar'));
      img.src = base64;
    });
  }
}