import { useCallback, useRef } from 'react';
import { Platform, View } from 'react-native';

export interface ElementMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
}

type RefKey = string;

/**
 * Hook reusable untuk mengukur posisi absolut elemen-elemen di layar.
 *
 * Cara penggunaan:
 * ```ts
 * const { getRef, measureAll } = useElementMeasure(['viewfinder', 'output', 'torch']);
 *
 * // Di JSX:
 * <View ref={getRef('viewfinder')} />
 *
 * // Untuk mendapatkan ukuran semua elemen:
 * const measurements = await measureAll();
 * // measurements['viewfinder'] => { x, y, width, height }
 * ```
 */
export function useElementMeasure(keys: RefKey[]) {
  // Buat map ref untuk setiap key yang diberikan
  const refsMap = useRef<Map<RefKey, React.RefObject<View | null>>>(new Map());

  // Inisialisasi ref untuk setiap key (hanya sekali)
  keys.forEach((key) => {
    if (!refsMap.current.has(key)) {
      refsMap.current.set(key, { current: null });
    }
  });

  /**
   * Ambil ref untuk key tertentu, untuk dipasang ke elemen via `ref={getRef('key')}`.
   */
  const getRef = useCallback(
    (key: RefKey): React.RefObject<View | null> => {
      if (!refsMap.current.has(key)) {
        refsMap.current.set(key, { current: null });
      }
      return refsMap.current.get(key)!;
    },
    []
  );

  /**
   * Ukur posisi absolut satu elemen.
   * Mengembalikan null jika elemen belum ter-mount atau tidak tersedia.
   */
  const measureElement = useCallback(
    (key: RefKey): Promise<ElementMeasurement | null> => {
      return new Promise((resolve) => {
        const ref = refsMap.current.get(key);
        if (!ref?.current) {
          resolve(null);
          return;
        }

        if (Platform.OS === 'web') {
          // Web: gunakan getBoundingClientRect via measureInWindow yang tersedia di web
          ref.current.measureInWindow((x, y, width, height) => {
            if (width === 0 && height === 0) {
              resolve(null);
            } else {
              resolve({ x, y, width, height });
            }
          });
        } else {
          // Native: measureInWindow memberikan posisi relatif ke window
          ref.current.measureInWindow((x, y, width, height) => {
            if (width === 0 && height === 0) {
              resolve(null);
            } else {
              resolve({ x, y, width, height });
            }
          });
        }
      });
    },
    []
  );

  /**
   * Ukur semua elemen secara paralel.
   * Mengembalikan map dari key ke hasil pengukuran (atau null jika gagal).
   */
  const measureAll = useCallback(
    async (): Promise<Record<RefKey, ElementMeasurement | null>> => {
      const results: Record<RefKey, ElementMeasurement | null> = {};

      await Promise.all(
        keys.map(async (key) => {
          results[key] = await measureElement(key);
        })
      );

      return results;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measureElement, ...keys]
  );

  return { getRef, measureAll, measureElement };
}
