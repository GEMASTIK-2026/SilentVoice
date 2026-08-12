import { useEffect, useRef, useState, useCallback } from 'react';
import { DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { WORD_LABELS, ONNX_TENSOR_SIZES, PREPROCESSING } from './preprocessingConfig';

// ORT harus di MODULE-LEVEL (bukan di dalam initOnnx) — dipakai oleh initOnnx DAN
// processQueue. Kalau dideklarasikan lokal di initOnnx, processQueue tidak punya
// akses ke `ort` → "ReferenceError: Property 'ort' doesn't exist" (terbukti di log).
const ort = require('onnxruntime-react-native');

// Event names (sinkron dengan Kotlin: LipPipelineRunner.EVENT_CLIP_READY dll)
const EV_CLIP_READY = 'onClipReady';
const EV_CAPTURE_FAILED = 'onCaptureFailed';
const EV_STATE_CHANGE = 'onCaptureState';
const EV_FACE_DETECTED = 'onFaceDetected';

/** State machine native dari LipCaptureEngine: "idle" | "waiting" | "recording". */
export type EngineState = 'idle' | 'waiting' | 'recording';

export interface ClipResult {
  sequenceId: number;
  word: string;
  confidence: number;
}

export interface ClipPending {
  sequenceId: number;
  status: 'processing' | 'failed';
  reason?: string;
}

export type CaptureState = 'idle' | 'listening' | 'processing' | 'done';

interface ClipEvent {
  sequence_id: number;
  visual_base64: string;
  landmark_base64: string;
  visual_shape_0: number;
  visual_shape_1: number;
  visual_shape_2: number;
  visual_shape_3: number;
  visual_shape_4: number;
  visual_shape_5: number;
  landmark_shape_0: number;
  landmark_shape_1: number;
}

/**
 * Hook untuk mengelola sesi capture + queue inference ONNX.
 * Output card menampilkan hasil terurut sesuai sequence_id.
 */
export function useCaptureEngine() {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [results, setResults] = useState<ClipResult[]>([]);
  const [pending, setPending] = useState<ClipPending[]>([]);
  // State machine native (LipCaptureEngine) + status deteksi wajah — untuk status pill UI.
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [faceDetected, setFaceDetected] = useState(false);

  // FIFO queue by sequence_id
  const queueRef = useRef<ClipEvent[]>([]);
  const processedSetRef = useRef<Set<number>>(new Set());
  const ortSessionRef = useRef<any>(null); // onnxruntime inference session
  const sessionActiveRef = useRef(false);

  // Inisialisasi ONNX session — panggil sekali saat mount
  useEffect(() => {
    initOnnx();
    return () => {
      ortSessionRef.current?.release();
    };
  }, []);

  // Listener event native
  useEffect(() => {
    const emitter = Platform.OS === 'android'
      ? DeviceEventEmitter
      : new NativeEventEmitter(NativeModules['LipPipelineRunner'] as any);

    const clipSub = emitter.addListener(EV_CLIP_READY, handleClipEvent);
    const failSub = emitter.addListener(EV_CAPTURE_FAILED, handleFailEvent);
    const stateSub = emitter.addListener(EV_STATE_CHANGE, (e: { state?: string }) => {
      const s = e?.state as EngineState;
      if (s === 'idle' || s === 'waiting' || s === 'recording') setEngineState(s);
    });
    const faceSub = emitter.addListener(EV_FACE_DETECTED, (e: { detected?: boolean }) => {
      setFaceDetected(!!e?.detected);
    });

    return () => {
      clipSub.remove();
      failSub.remove();
      stateSub.remove();
      faceSub.remove();
    };
  }, []);

  const initOnnx = async () => {
    try {
      // require() pada asset .onnx mengembalikan MODULE ID (angka), bukan objek/string.
      // expo-asset mengubahnya menjadi objek Asset dengan .localUri (path file:// lokal)
      // yang diterima InferenceSession.create() — berlaku di dev (Metro) & produksi (EAS).
      const asset = Asset.fromModule(require('../../assets/models/final_base_model.onnx'));
      await asset.downloadAsync();

      const session = await ort.InferenceSession.create(asset.localUri ?? asset.uri);
      ortSessionRef.current = session;
      console.log('ONNX session created');
    } catch (e) {
      console.warn('ONNX init error (akan tercoba ulang saat clip pertama):', e);
    }
  };

  const handleClipEvent = (event: ClipEvent) => {
    const seqId = event.sequence_id;

    // Abaikan kalau sudah diproses
    if (processedSetRef.current.has(seqId)) return;

    // Tambah ke queue + pending display
    queueRef.current.push(event);
    setPending((prev) => [...prev, { sequenceId: seqId, status: 'processing' }]);

    // Proses batch: untuk setiap clip di queue, jalankan inference
    processQueue();
  };

  const handleFailEvent = (event: { sequence_id: number; reason: string }) => {
    setPending((prev) => [
      ...prev,
      { sequenceId: event.sequence_id, status: 'failed', reason: event.reason },
    ]);
  };

  const processQueue = async () => {
    const queue = queueRef.current;
    const session = ortSessionRef.current;

    if (!session || queue.length === 0) return;

    while (queue.length > 0) {
      const clip = queue.shift()!;
      const seqId = clip.sequence_id;

      if (processedSetRef.current.has(seqId)) continue;

      try {
        // Base64 → Float32Array
        const visual = base64ToFloat32(clip.visual_base64);
        const landmark = base64ToFloat32(clip.landmark_base64);

        // Validasi size
        if (visual.length !== ONNX_TENSOR_SIZES.visual) {
          console.warn(`Visual size mismatch: ${visual.length} vs ${ONNX_TENSOR_SIZES.visual}`);
          markFailed(seqId, 'size_mismatch');
          continue;
        }
        if (landmark.length !== ONNX_TENSOR_SIZES.landmark) {
          console.warn(`Landmark size mismatch: ${landmark.length} vs ${ONNX_TENSOR_SIZES.landmark}`);
          markFailed(seqId, 'size_mismatch');
          continue;
        }

        // ONNX inference
        const feeds: Record<string, any> = {
          visual: new ort.Tensor('float32', visual, [1, 2, 30, 20, 10, 10]),
          landmark: new ort.Tensor('float32', landmark, [1, 30, 161]),
        };
        const output = await session.run(feeds);
        const logits = output.logits_word?.data as Float32Array;

        if (!logits || logits.length === 0) {
          markFailed(seqId, 'empty_output');
          continue;
        }

        // Argmax + softmax confidence (top-1)
        const { argmax, maxVal } = softmaxArgmax(logits);

        const word = WORD_LABELS[argmax] ?? '???';
        processedSetRef.current.add(seqId);

        // Update hasil
        setResults((prev) => {
          const updated = [...prev, { sequenceId: seqId, word, confidence: maxVal }];
          // Urutkan berdasarkan sequenceId
          updated.sort((a, b) => a.sequenceId - b.sequenceId);
          return updated;
        });

        setPending((prev) => prev.filter((p) => p.sequenceId !== seqId));
      } catch (e: any) {
        console.error('Inference error for clip', seqId, e);
        markFailed(seqId, `inference_error: ${e.message}`);
      }
    }
  };

  const markFailed = (seqId: number, reason: string) => {
    setPending((prev) => [
      ...prev.filter((p) => p.sequenceId !== seqId),
      { sequenceId: seqId, status: 'failed', reason },
    ]);
  };

  /** Mulai sesi (native side: WAITING_FOR_OPEN loop) */
  const startSession = useCallback(() => {
    setCaptureState('listening');
    setResults([]);
    setPending([]);
    setEngineState('waiting');
    setFaceDetected(false);
    queueRef.current = [];
    processedSetRef.current.clear();
    sessionActiveRef.current = true;

    // Native module lipFrameProcessor
    LipPipelineRunnerModule?.startSession();
  }, []);

  /** Hentikan sesi — clip yang masih di queue tetap diproses */
  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    LipPipelineRunnerModule?.stopSession();
    setCaptureState('idle');
    setEngineState('idle');
    setFaceDetected(false);
  }, []);

  const LipPipelineRunnerModule = NativeModules['LipPipelineRunner'];

  const softmaxArgmax = (logits: Float32Array): { argmax: number; maxVal: number } => {
    // Softmax stabil
    const max = Math.max(...Array.from(logits));
    const exps = Array.from(logits).map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((v) => v / sum);

    let argmax = 0;
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > probs[argmax]) argmax = i;
    }
    return { argmax, maxVal: probs[argmax] };
  };

  return {
    captureState,
    setCaptureState,
    results,
    pending,
    engineState,
    faceDetected,
    startSession,
    stopSession,
  };
}

const b64Lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToFloat32(b64: string): Float32Array {
  // Decode base64 ke byte buffer
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  // Interpret 4 bytes sebagai float32 (little-endian)
  const floats = new Float32Array(bytes.buffer);
  return floats;
}