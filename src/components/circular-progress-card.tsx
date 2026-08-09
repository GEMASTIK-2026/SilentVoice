import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CircularProgressCardProps {
  current?: number;
  total?: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  className?: string;
  style?: ViewStyle;
}

export function CircularProgressCard({
  current = 6,
  total = 10,
  label = 'KATA DI KALIBRASI',
  size = 120,
  strokeWidth = 12,
  color = '#0E8549',
  backgroundColor = '#E2E8F0',
  className = '',
  style,
}: CircularProgressCardProps) {
  // Hitung radius & keliling lingkaran (2 * π * r)
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Hitung persentase progress (0.0 - 1.0)
  const progress = Math.min(Math.max(current / total, 0), 1);
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View
      className={`bg-white rounded-3xl p-3.5 items-center justify-between border border-slate-100/80 ${className}`}
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
      {/* Container Ring Progress & Angka Tengah */}
      <View style={{ width: size, height: size }} className="items-center justify-center relative my-auto">
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Ring Belakang (Track) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Ring Progress Depan (Warna Hijau) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            opacity={0.8}
          />
        </Svg>

        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          <Text className="text-[#1E293B] text-3xl font-hanken-bold tracking-tight">
            {current}
            <Text className="text-[#1E293B] text-3xl font-hanken-bold">/{total}</Text>
          </Text>
        </View>
      </View>

      {/* Label Bawah */}
      {label && (
        <Text className="text-slate-800 text-[10px] font-hanken-bold uppercase tracking-wider text-center mt-1">
          {label}
        </Text>
      )}
    </View>
  );
}
