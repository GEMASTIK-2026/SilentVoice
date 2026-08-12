import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  VisionCameraProxy,
  type Frame,
  type CameraPosition,
} from 'react-native-vision-camera';

interface LipCaptureViewProps {
  facing: 'front' | 'back';
  enableTorch: boolean;
  isRecording: boolean;
  sessionActive: boolean;
  onFrameProcessorReady?: () => void;
}

/**
 * Komponen kamera untuk lip-reading.
 * Menggantikan expo-camera CameraView dengan react-native-vision-camera
 * + custom Frame Processor Plugin native (lipFrameProcessor).
 *
 * Semua styling/overlay/spotlight dipertahankan di parent â€” komponen ini
 * hanya mengganti sumber video.
 */
export function LipCaptureView({
  facing,
  enableTorch,
  isRecording,
  sessionActive,
  onFrameProcessorReady,
}: LipCaptureViewProps) {
  const device = useCameraDevice(facing);
  const { hasPermission, requestPermission } = useCameraPermission();
  const deviceRef = useRef(device);

  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  // Minta permission kalau belum
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Frame processor: panggil plugin native secara EKSPLISIT.
  // VisionCamera TIDAK memanggil plugin otomatis â€” worklet harus memanggil
  // VisionCameraProxy.initFrameProcessorPlugin(name)?.call(frame) per frame.
  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';
    const plugin = VisionCameraProxy.initFrameProcessorPlugin('lipFrameProcessor', {});
    plugin?.call(frame);
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Memerlukan izin kamera untuk lip-reading.</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Kamera tidak tersedia pada perangkat ini.</Text>
      </View>
    );
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      video={false}
      photo={false}
      torch={enableTorch ? 'on' : 'off'}
      frameProcessor={frameProcessor}
      pixelFormat="yuv"
      onError={(err) => console.warn('Camera error:', err)}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
});

// Re-export untuk kompatibilitas
export { useCameraDevice, useCameraPermission };
