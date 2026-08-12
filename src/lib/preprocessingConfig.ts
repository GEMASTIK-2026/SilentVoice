/**
 * Konstanta preprocessing — SUMBER KEBENARAN dari precompute-lcp-v7--Multimodal.ipynb
 * dan checkpoint final_base_model.pth (Tahap 1 & 2).
 *
 * JANGAN UBAH nilai ini tanpa verifikasi ulang dari notebook — satu angka
 * salah bisa merusak akurasi model tanpa error yang terlihat.
 */

/** Urutan 10 kelas kata — PERSIS urutan output softmax model (index 0-9). */
export const WORD_LABELS = [
  'Maaf',
  'Tolong',
  'Permisi',
  'Halo',
  'Mulai',
  'Berhenti',
  'Lanjut',
  'Sakit',
  'Kembali',
  'Awas',
] as const;

export const PREPROCESSING = {
  /** Ukuran crop visual (persegi) setelah align */
  TARGET_SIZE: 96,
  /** Ukuran tiap patch di sekitar landmark */
  PATCH_SIZE: 10,
  /** Jumlah titik landmark untuk cabang visual (subsample genap dari 40) */
  NUM_VISUAL_LANDMARKS: 20,
  /** Frame per kata */
  SEQ_LEN_WORD: 30,
  /** Sensitivitas threshold segmen ucapan */
  MAR_K_STD: 0.5,
  /** Window smoothing MAR */
  MAR_SMOOTH_WIN: 3,
  /** Padding proporsional bbox bibir */
  PAD_RATIO: 0.15,
  /** Ukuran minimum bbox bibir */
  MIN_BOX_SIZE: 20,
  /** Mode channel visual: gray + frame-diff temporal */
  VISUAL_MODE: 'gray+diff',
  /** Channel visual = 2 (gray + diff) */
  VISUAL_CHANNELS: 2,
} as const;

/** Dimensi input ONNX (dari inspeksi final_base_model.onnx) */
export const ONNX_SHAPES = {
  visual: [1, 2, 30, 20, 10, 10] as const,   // [batch, C, T, K, H, W]
  landmark: [1, 30, 161] as const,           // [batch, T, 161]
} as const;

/** Jumlah total elemen tiap tensor (untuk buffer Float32) */
export const ONNX_TENSOR_SIZES = {
  visual: 2 * 30 * 20 * 10 * 10,   // 120_000
  landmark: 30 * 161,              // 4_830
} as const;

/** Landmark MediaPipe 478-point: 40 titik bibir unik terurut (LIPS_IDX) */
export const LIPS_IDX = [
  0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95,
  146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314,
  317, 318, 321, 324, 375, 402, 405, 409, 415,
];

/** LIPS_PAIRS (40 pasang) dari notebook — untuk referensi visual */
export const LIPS_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314],
  [314, 405], [405, 321], [321, 375], [375, 291],
  [61, 185], [185, 40], [40, 39], [39, 37], [37, 0],
  [0, 267], [267, 269], [269, 270], [270, 409], [409, 291],
  [78, 95], [95, 88], [88, 178], [178, 87], [87, 14], [14, 317],
  [317, 402], [402, 318], [318, 324], [324, 308],
  [78, 191], [191, 80], [80, 81], [81, 82], [82, 13],
  [13, 312], [312, 311], [311, 310], [310, 415], [415, 308],
];

/** Posisi MAR inner-lip di LIPS_IDX (lokal) */
export const MAR_LOCAL = {
  top: 1,     // global 13
  bot: 2,     // global 14
  left: 8,    // global 78
  right: 26,  // global 308
} as const;

/** Mata untuk normalisasi */
export const EYE_OUTER = { left: 33, right: 263 } as const;

/** PATCH_LIP_LOCAL_IDX = genap 0..38 */
export const PATCH_LOCAL_IDX = Array.from({ length: 20 }, (_, i) => i * 2);
