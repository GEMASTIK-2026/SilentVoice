import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { View } from 'react-native';
import { type SFSymbol, type AndroidSymbol } from 'expo-symbols';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TutorialStep {
  id: string;
  /**
   * Key yang merujuk ke ref yang telah di-register via useTutorialTarget().
   * Overlay akan mengukur elemen ini saat menampilkan langkah yang bersangkutan.
   */
  targetKey: string;
  title: string;
  description: string;
  icon: {
    ios: SFSymbol;
    android: AndroidSymbol;
    web: AndroidSymbol;
  };
  /** Padding tambahan (px) di sekeliling spotlight hole. Default: 8 */
  spotlightPadding?: number;
  /**
   * Override border-radius spotlight. Default: auto
   * — elemen hampir persegi (tombol bulat) → radius penuh
   * — elemen persegi panjang → 24px
   */
  spotlightRadius?: number;
  /** Posisi tooltip card relatif terhadap area yang di-highlight. Default: 'auto' */
  tooltipPosition?: 'top' | 'bottom' | 'auto';
  /** Jarak (px) antara batas highlight dan tooltip card. Default: 16 */
  tooltipOffset?: number;
}

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface TutorialContextValue {
  // State
  visible: boolean;
  steps: TutorialStep[];
  currentStepIndex: number;

  // Actions
  showTutorial: (steps: TutorialStep[], options?: { force?: boolean }) => void;
  hideTutorial: () => void;
  goNext: () => void;
  goPrev: () => void;

  // Target registry
  registerTarget: (key: string, ref: RefObject<View | null>) => void;
  unregisterTarget: (key: string) => void;
  measureTarget: (key: string) => Promise<TargetRect | null>;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Ref sehingga goNext/goPrev tidak perlu re-create ketika steps berubah
  const stepsRef = useRef<TutorialStep[]>([]);
  // Setelah user dismiss (skip/finish), jangan tampilkan lagi di sesi ini
  const dismissedRef = useRef(false);
  // Registry: targetKey → RefObject<View | null>
  const registryRef = useRef<Map<string, RefObject<View | null>>>(new Map());

  // ── Registry ──────────────────────────────────────────────────────────────

  const registerTarget = useCallback((key: string, ref: RefObject<View | null>) => {
    registryRef.current.set(key, ref);
  }, []);

  const unregisterTarget = useCallback((key: string) => {
    registryRef.current.delete(key);
  }, []);

  /**
   * Ukur posisi absolut target yang terdaftar pada layar.
   * Retry hingga MAX_RETRIES kali jika elemen belum selesai di-layout (0×0).
   */
  const measureTarget = useCallback((key: string): Promise<TargetRect | null> => {
    return new Promise((resolve) => {
      const ref = registryRef.current.get(key);
      if (!ref?.current) {
        resolve(null);
        return;
      }

      const MAX_RETRIES = 8;
      let attempts = 0;

      const doMeasure = () => {
        ref.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            resolve({ x, y, width, height });
          } else if (attempts < MAX_RETRIES) {
            attempts++;
            setTimeout(doMeasure, 60);
          } else {
            resolve(null);
          }
        });
      };

      requestAnimationFrame(doMeasure);
    });
  }, []);

  // ── Tutorial actions ───────────────────────────────────────────────────────

  const showTutorial = useCallback(
    (newSteps: TutorialStep[], options?: { force?: boolean }) => {
      if (options?.force) dismissedRef.current = false;
      if (dismissedRef.current) return;

      stepsRef.current = newSteps;
      setSteps(newSteps);
      setCurrentStepIndex(0);
      setVisible(true);
    },
    []
  );

  const hideTutorial = useCallback(() => {
    dismissedRef.current = true;
    setVisible(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, stepsRef.current.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = useMemo<TutorialContextValue>(
    () => ({
      visible,
      steps,
      currentStepIndex,
      showTutorial,
      hideTutorial,
      goNext,
      goPrev,
      registerTarget,
      unregisterTarget,
      measureTarget,
    }),
    [
      visible,
      steps,
      currentStepIndex,
      showTutorial,
      hideTutorial,
      goNext,
      goPrev,
      registerTarget,
      unregisterTarget,
      measureTarget,
    ]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial harus digunakan di dalam <TutorialProvider>');
  return ctx;
}

/**
 * Register sebuah View sebagai target tutorial dengan nama unik.
 * Overlay akan mengukur elemen ini saat menampilkan langkah yang sesuai.
 * Auto-unregister saat komponen unmount.
 *
 * Penggunaan:
 * ```tsx
 * const ref = useTutorialTarget('header-section');
 * return <View ref={ref} />;
 * ```
 */
export function useTutorialTarget(key: string): RefObject<View | null> {
  // Gunakan useContext langsung (bukan useTutorial) agar aman di luar Provider
  const ctx = useContext(TutorialContext);
  const ref = useRef<View | null>(null);

  useEffect(() => {
    if (!ctx) return; // Graceful no-op jika digunakan di luar Provider
    ctx.registerTarget(key, ref);
    return () => {
      ctx.unregisterTarget(key);
    };
  }, [key, ctx]);

  return ref;
}
