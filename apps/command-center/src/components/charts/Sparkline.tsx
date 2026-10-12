import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '@/theme';
import { useChartSize } from './useChartSize';

type SparklineProps = {
  values: number[];
  /** Line colour; defaults to the app's trend orange (as in the full line chart). */
  color?: string;
  height?: number;
};

/**
 * Tiny decorative trend in the app's line style: straight segments and the
 * latest point ringed. The surrounding text states the numbers.
 */
export function Sparkline({ values, color, height = 36 }: SparklineProps) {
  const theme = useTheme();
  const { width, onLayout } = useChartSize();
  const line = color ?? theme.colors.pie[1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const inner = Math.max(0, width - 10);
  const step = values.length > 1 ? inner / (values.length - 1) : 0;
  const points = values.map((value, index) => ({
    x: 4 + index * step,
    y: 5 + (height - 10) * (1 - (value - min) / span),
  }));
  const last = points[points.length - 1];
  return (
    <View aria-hidden onLayout={onLayout} style={{ height, alignSelf: 'stretch' }}>
      {width > 0 && values.length > 1 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            stroke={line}
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
          <Circle
            cx={last.x}
            cy={last.y}
            r={3.5}
            fill={theme.colors.surface}
            stroke={line}
            strokeWidth={2}
          />
        </Svg>
      ) : null}
    </View>
  );
}
