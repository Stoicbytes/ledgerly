import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTween } from '@/hooks/useTween';
import { useTheme, type ColorRoles } from '@/theme';

type RingTone = Extract<
  keyof ColorRoles,
  'accent' | 'primary' | 'brandFrom' | 'success' | 'warning' | 'danger' | 'investment' | 'onBrand'
>;

type ProgressRingProps = {
  value: number;
  accessibilityLabel: string;
  size?: number;
  strokeWidth?: number;
  tone?: RingTone;
  /** Centre content, e.g. the percentage. */
  children?: ReactNode;
};

export function ProgressRing({
  value,
  accessibilityLabel,
  size = 88,
  strokeWidth = 8,
  tone = 'brandFrom',
  children,
}: ProgressRingProps) {
  const theme = useTheme();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(clamped * 100);
  const progress = useTween(percent, 900);
  return (
    <View
      role="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} percent` }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }} aria-hidden>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * clamped * progress} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
