import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

interface AccuracySparklineCardProps {
  percentage?: number; // Nilai persentase (contoh: 70)
  title?: string;      // Judul atas (default: "KETEPATAN\nKONVERSI")
  dataPoints?: number[]; // Poin tren grafik (misal: [45, 20, 32, 12])
  color?: string;      // Warna garis & titik (default: "#22C55E")
  graphOpacity?: number; // Tingkat transparansi grafik background (default: 0.35)
  className?: string;
  style?: ViewStyle;
}

export function AccuracySparklineCard({
  percentage = 70,
  title = 'KETEPATAN\nKONVERSI',
  dataPoints = [45, 20, 32, 12],
  color = '#E2E8F0',
  graphOpacity = 1,
  className = '',
  style,
}: AccuracySparklineCardProps) {
  // Ukuran SVG Sparkline
  const width = 250;
  const height = 80;
  const padding = 8;

  // Hitung koordinat X dan Y untuk tiap titik pada SVG
  const pointsCount = dataPoints.length;
  const stepX = (width - padding * 2) / (pointsCount - 1);

  // Normalisasi dataPoints ke koordinat Y di dalam SVG
  const minY = Math.min(...dataPoints);
  const maxY = Math.max(...dataPoints);
  const rangeY = maxY - minY || 1;

  const points = dataPoints.map((val, i) => {
    const x = padding + i * stepX;
    // Y di SVG diukur dari atas ke bawah, jadi dibalik
    const y = height - padding - ((val - minY) / rangeY) * (height - padding * 2);
    return { x, y };
  });

  // Format string untuk prop `points` pada Polyline
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View
      className={`bg-white rounded-3xl p-5 justify-between relative overflow-hidden border border-slate-200/50 ${className}`}
      style={[
        {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.03,
          shadowRadius: 20,
          elevation: 1.5,
          minHeight: 140,
        },
        style,
      ]}
    >
      {/* ── Background Sparkline Graph (Dimmed / Redup) ── */}
      <View
        className="absolute -bottom-1 -right-8 pointer-events-none z-0 rotate-[-25deg]"
        style={{ opacity: graphOpacity }}
      >
        <Svg width={width} height={height}>
          {/* Garis Tren */}
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Titik-titik Node Lingkaran */}
          {points.map((p, index) => (
            <Circle
              key={index}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="#F0F7F4"
              stroke={color}
              strokeWidth={2.5}
            />
          ))}
        </Svg>
      </View>

      {/* ── Content Text Overlay (Z-10) ── */}
      <View className="z-10 flex-1 justify-between">
        {/* Judul Atas (Uppercase & Bold) */}
        <Text className="text-slate-900 text-[11px] font-hanken-bold tracking-wider leading-tight">
          {title}
        </Text>

        {/* Nilai Persentase Utama ("70%") */}
        <Text className="text-slate-900 text-4xl font-hanken-bold tracking-tight my-auto">
          {percentage}%
        </Text>
      </View>
    </View>
  );
}
