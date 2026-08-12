import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { type ElementMeasurement } from '@/hooks/useElementMeasure';
import { type SpotlightStep } from '@/components/spotlight-overlay';

// ─── Nav Measurement Context ───────────────────────────────────────────────

interface NavMeasurements {
  recordBtn?: ElementMeasurement;
  helpBtn?: ElementMeasurement;
}

interface NavMeasurementContextValue {
  navMeasurements: NavMeasurements;
  setMeasurement: (key: keyof NavMeasurements, value: ElementMeasurement) => void;
  getMeasurements: () => NavMeasurements;
}

const NavMeasurementContext = createContext<NavMeasurementContextValue | null>(null);

// ─── Spotlight Context ─────────────────────────────────────────────────────

/** ID step yang memerlukan highlight langsung pada tombol nav bar */
const NAV_STEP_IDS: Record<string, 'record' | 'help'> = {
  step_record_btn: 'record',
  help_btn: 'help',
};

interface SpotlightContextValue {
  showSpotlight: (steps: SpotlightStep[], options?: { force?: boolean }) => void;
  hideSpotlight: () => void;
  spotlightState: {
    visible: boolean;
    steps: SpotlightStep[];
    currentStepIndex: number;
  };
  /**
   * Tombol nav bar yang sedang di-highlight tutorial saat ini.
   * null = langkah ini bukan tentang nav bar (pakai dark overlay biasa).
   */
  navHighlight: 'record' | 'help' | null;
  goNext: () => void;
  goPrev: () => void;
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

// ─── Combined Provider ─────────────────────────────────────────────────────

export function TabsProvider({ children }: { children: React.ReactNode }) {
  // Nav measurements state (reaktif agar listener re-render saat posisi terukur)
  const [navMeasurements, setNavMeasurements] = useState<NavMeasurements>({});

  const setMeasurement = useCallback(
    (key: keyof NavMeasurements, value: ElementMeasurement) => {
      setNavMeasurements((prev) => {
        const curr = prev[key];
        if (
          curr &&
          curr.x === value.x &&
          curr.y === value.y &&
          curr.width === value.width &&
          curr.height === value.height
        ) {
          return prev;
        }
        return { ...prev, [key]: value };
      });
    },
    []
  );

  const getMeasurements = useCallback(() => navMeasurements, [navMeasurements]);

  // Spotlight state
  const [spotlightState, setSpotlightState] = useState<{
    visible: boolean;
    steps: SpotlightStep[];
    currentStepIndex: number;
  }>({ visible: false, steps: [], currentStepIndex: 0 });

  // Flag ref: true jika tutorial sudah diselesaikan/ditutup oleh user pada sesi ini
  const dismissedRef = useRef(false);

  const showSpotlight = useCallback((steps: SpotlightStep[], options?: { force?: boolean }) => {
    if (options?.force) {
      dismissedRef.current = false;
    }
    // Jika user sudah pernah menutup/menyelesaikan tutorial, jangan buka lagi
    if (dismissedRef.current) {
      return;
    }
    setSpotlightState((prev) => ({
      visible: true,
      steps,
      // Pertahankan index langkah yang sedang berjalan jika sudah terbuka
      currentStepIndex: prev.visible ? prev.currentStepIndex : 0,
    }));
  }, []);

  const hideSpotlight = useCallback(() => {
    dismissedRef.current = true;
    setSpotlightState((prev) => ({ ...prev, visible: false }));
  }, []);

  const goNext = useCallback(() => {
    setSpotlightState((prev) => ({
      ...prev,
      currentStepIndex: Math.min(prev.currentStepIndex + 1, prev.steps.length - 1),
    }));
  }, []);

  const goPrev = useCallback(() => {
    setSpotlightState((prev) => ({
      ...prev,
      currentStepIndex: Math.max(prev.currentStepIndex - 1, 0),
    }));
  }, []);

  // Derived: tombol nav bar mana yang perlu di-highlight (null = bukan langkah nav)
  const navHighlight = useMemo<'record' | 'help' | null>(() => {
    if (!spotlightState.visible) return null;
    const stepId = spotlightState.steps[spotlightState.currentStepIndex]?.id ?? '';
    return NAV_STEP_IDS[stepId] ?? null;
  }, [spotlightState]);

  return (
    <NavMeasurementContext.Provider value={{ navMeasurements, setMeasurement, getMeasurements }}>
      <SpotlightContext.Provider value={{ showSpotlight, hideSpotlight, spotlightState, navHighlight, goNext, goPrev }}>
        {children}
      </SpotlightContext.Provider>
    </NavMeasurementContext.Provider>
  );
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useNavMeasurement() {
  const ctx = useContext(NavMeasurementContext);
  if (!ctx) throw new Error('useNavMeasurement harus digunakan di dalam TabsProvider');
  return ctx;
}

export function useSpotlight() {
  const ctx = useContext(SpotlightContext);
  if (!ctx) throw new Error('useSpotlight harus digunakan di dalam TabsProvider');
  return ctx;
}
