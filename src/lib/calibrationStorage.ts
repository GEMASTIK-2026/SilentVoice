/**
 * Local storage kalibrasi — PART B.4 (TANPA backend/database).
 *  - METADATA status per kata: AsyncStorage (kecil, 10 kata x beberapa field)
 *  - TENSOR hasil precompute tiap rekaman: expo-file-system, disimpan sebagai
 *    file JSON di documentDirectory/calibration/<nama_kata>/<index>.json
 *    (visual_base64 + landmark_base64 siap pakai untuk fine-tuning Tahap 4).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { CALIBRATION_TARGET_COUNT, type CalibrationStatus } from './kamus-data';

const STATUS_KEY = 'calibration_status_v1';

// ── Metadata (AsyncStorage) ─────────────────────────────────────────────────

export async function getCalibrationStatuses(): Promise<Record<string, CalibrationStatus>> {
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CalibrationStatus>;
  } catch {
    return {};
  }
}

export async function getCalibrationStatus(wordLabel: string): Promise<CalibrationStatus> {
  const all = await getCalibrationStatuses();
  return all[wordLabel] ?? { count: 0, completed: false };
}

export async function setCalibrationStatus(
  wordLabel: string,
  status: CalibrationStatus
): Promise<void> {
  const all = await getCalibrationStatuses();
  all[wordLabel] = status;
  await AsyncStorage.setItem(STATUS_KEY, JSON.stringify(all));
}

export function isCalibrationCompleted(s: CalibrationStatus): boolean {
  return s.count >= CALIBRATION_TARGET_COUNT;
}

// ── Tensor hasil precompute (expo-file-system) ──────────────────────────────

export interface CalibrationRecordingPayload {
  visualBase64: string;
  landmarkBase64: string;
}

/**
 * Simpan satu rekaman kalibrasi sebagai file JSON lokal.
 * Path: documentDirectory/calibration/<nama_kata>/<index>.json
 * Mengembalikan URI file yang tersimpan.
 */
export async function saveCalibrationRecording(
  wordLabel: string,
  index: number,
  payload: CalibrationRecordingPayload
): Promise<string> {
  const dir = new Directory(Paths.document, 'calibration', wordLabel);
  dir.create({ idempotent: true, intermediates: true });

  const file = new File(dir, `${index}.json`);
  file.write(
    JSON.stringify({
      word: wordLabel,
      index,
      savedAt: new Date().toISOString(),
      visual_base64: payload.visualBase64,
      landmark_base64: payload.landmarkBase64,
    })
  );
  return file.uri;
}

/** URI folder calibration (untuk laporan/lokasi file ke user). */
export async function getCalibrationDirectoryUri(): Promise<string> {
  const dir = new Directory(Paths.document, 'calibration');
  dir.create({ idempotent: true, intermediates: true });
  return dir.uri;
}
