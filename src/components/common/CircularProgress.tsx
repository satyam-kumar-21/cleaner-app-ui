import React from 'react';
import { LocalizedText as Text } from '@/context/LanguageContext';
import { StyleSheet } from 'react-native';
import { ThemedView as View } from '@/context/ThemeContext';
import Svg, { Circle } from 'react-native-svg';

interface CircularProgressProps {
  /** Progress value from 0 to 100 */
  progress: number;
  /** Outer diameter of the circle */
  size?: number;
  /** Thickness of the progress stroke */
  strokeWidth?: number;
  /** Color of the progress arc */
  progressColor?: string;
  /** Color of the background track */
  trackColor?: string;
  /** Whether to show the percentage text inside */
  showPercentage?: boolean;
  /** Label text below the percentage */
  label?: string;
  /** Custom content to render inside the circle (overrides percentage display) */
  children?: React.ReactNode;
}

export default function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 10,
  progressColor = '#3B82F6',
  trackColor = '#E5E7EB',
  showPercentage = true,
  label,
  children,
}: CircularProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* Center content */}
      <View style={styles.centerContent}>
        {children ? (
          children
        ) : showPercentage ? (
          <>
            <Text style={styles.percentageText}>{Math.round(clampedProgress)}%</Text>
            {label && <Text style={styles.labelText}>{label}</Text>}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  labelText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});
