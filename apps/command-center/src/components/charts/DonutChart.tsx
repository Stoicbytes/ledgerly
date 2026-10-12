import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTween } from '@/hooks/useTween';
import { useTheme } from '@/theme';
import { arcPath } from './scales';

export type DonutSegment = { label: string; value: number; color: string };

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  accessibilityLabel: string;
  /** Highlights one segment (e.g. the legend row under the pointer). */
  activeLabel?: string | null;
  children?: ReactNode;
};

/** Ring with rounded, separated segments that sweep in. */
export function DonutChart({
  segments,
  size = 160,
  thickness = 18,
  accessibilityLabel,
  activeLabel,
  children,
}: DonutChartProps) {
  const theme = useTheme();
  const progress = useTween(segments.length, 1000);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2 - 2;
  // Rounded caps extend past an arc's ends by half the stroke, so trim each arc by
  // that angle plus a small gap; slivers too thin for caps use flat ends instead.
  const capAngle = thickness / 2 / radius;
  const gapAngle = segments.length > 1 ? 0.05 : 0;
  let cursor = 0;
  return (
    <View
      role="img"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }} aria-hidden>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceMuted}
          strokeWidth={thickness}
          fill="none"
        />
        {total > 0
          ? segments.map((segment) => {
              const fraction = segment.value / total;
              const sweep = fraction * Math.PI * 2;
              const from = cursor * progress;
              cursor += sweep;
              const to = from + sweep * progress;
              const rounded =
                segments.length === 1 || sweep * progress > 2 * capAngle + gapAngle * 2;
              const inset =
                segments.length === 1 ? 0 : rounded ? capAngle + gapAngle / 2 : gapAngle / 2;
              const start = from + inset;
              const end = Math.max(start + 0.001, to - inset);
              const dimmed = activeLabel && activeLabel !== segment.label;
              return (
                <Path
                  key={segment.label}
                  d={arcPath(
                    size / 2,
                    size / 2,
                    radius,
                    start,
                    Math.min(end, start + Math.PI * 2 - 0.001),
                  )}
                  stroke={segment.color}
                  strokeWidth={activeLabel === segment.label ? thickness + 4 : thickness}
                  strokeLinecap={rounded ? 'round' : 'butt'}
                  opacity={dimmed ? 0.35 : 1}
                  fill="none"
                />
              );
            })
          : null}
      </Svg>
      {children}
    </View>
  );
}
