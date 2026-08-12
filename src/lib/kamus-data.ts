/**
 * Data Kamus & konstanta kalibrasi — PART B.
 * Urutan kata PERSIS sama dengan urutan output softmax model
 * (sumber: preprocessingConfig.WORD_LABELS dari checkpoint Tahap 1).
 */
import { WORD_LABELS } from './preprocessingConfig';

/** Target jumlah rekaman per kata untuk kalibrasi (mudah diubah). */
export const CALIBRATION_TARGET_COUNT = 5;

export interface WordItem {
  /** Index output model (0-9) — KRITIS: urutan ini = urutan logits */
  id: number;
  label: string;
}

/** Daftar 10 kata untuk halaman Kamus — urutannya TIDAK BOLEH diubah. */
export const KAMUS_WORDS: WordItem[] = WORD_LABELS.map((label, idx) => ({
  id: idx,
  label,
}));

/** Status kalibrasi per kata. */
export interface CalibrationStatus {
  count: number;        // jumlah rekaman terkumpul (0..TARGET)
  completed: boolean;   // count >= TARGET
}

export const EMPTY_STATUS: CalibrationStatus = { count: 0, completed: false };
