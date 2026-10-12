import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { fontFamily, useTheme } from '@/theme';
import { HitColumns, PointButtons } from './HitColumns';
import { anchorFor, trendLayout } from './trendLayout';
import { useChartSize } from './useChartSize';

export type TrendPoint = {
  label: string;
  /** Second line under the label (e.g. the year under January). */
  sublabel?: string;
  value: number;
  /** Name read out for the point, e.g. "December 2025". */
  name: string;
};

type TrendLineChartProps = {
  points: TrendPoint[];
  /** Line colour; defaults to the app's trend orange. */
  color?: string;
  /** A second series drawn as a dashed grey line (e.g. amount invested). */
  compare?: { name: string; values: number[] };
  /** Index of the ringed point (the period on screen). Dense series ring the latest. */
  selected?: number;
  formatValue: (value: number) => string;
  /** Pressing a point; each point is then a labelled button. Without it, touch shows values. */
  onSelect?: (index: number) => void;
  accessibilityLabel: string;
  /** Fixed height; omit to fill the parent (fit layouts). */
  height?: number;
};

/**
 * The app's line chart, after Money Manager's category trend: an orange line
 * with the value over each point and the selected point ringed.
 */
export function TrendLineChart({
  points,
  color,
  compare,
  selected,
  formatValue,
  onSelect,
  accessibilityLabel,
  height,
}: TrendLineChartProps) {
  const theme = useTheme();
  const { width, height: measured, onLayout } = useChartSize();
  const [touched, setTouched] = useState<number | null>(null);
  const chartHeight = height ?? measured;
  const values = points.map((point) => point.value);
  const layout = trendLayout({
    values,
    compare: compare?.values,
    width,
    height: chartHeight,
    active: touched ?? selected,
  });
  const { x, y, dense } = layout;
  const ringed = touched ?? selected ?? (dense ? values.length - 1 : undefined);
  const line = color ?? theme.colors.pie[1];
  const path = (series: number[]) =>
    series.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const textFor = (active: boolean) => ({
    fontFamily: active ? fontFamily.semibold : fontFamily.regular,
    fill: active ? theme.colors.textPrimary : theme.colors.textSecondary,
  });
  return (
    <View
      role="img"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={height ? { height } : { flex: 1, minHeight: 140 }}
    >
      {width > 0 && chartHeight > 0 ? (
        <Svg width={width} height={chartHeight} aria-hidden>
          {layout.gridY.map((gridY) => (
            <Line
              key={gridY}
              x1={0}
              x2={width}
              y1={gridY}
              y2={gridY}
              stroke={theme.colors.chartGrid}
            />
          ))}
          {layout.ticks.map((index) => (
            <Line
              key={index}
              x1={x(index)}
              x2={x(index)}
              y1={layout.plotTop - 8}
              y2={layout.plotBottom}
              stroke={theme.colors.chartGrid}
            />
          ))}
          {compare ? (
            <Polyline
              points={path(compare.values)}
              fill="none"
              stroke={theme.colors.textTertiary}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ) : null}
          <Polyline
            points={path(values)}
            fill="none"
            stroke={line}
            strokeWidth={dense ? 2 : 2.5}
            strokeLinejoin="round"
          />
          {points.map((point, index) => {
            if (!layout.labelled.has(index)) return null;
            const active = index === ringed;
            const pointY = y(point.value);
            return (
              <G key={index}>
                <Circle
                  cx={x(index)}
                  cy={pointY}
                  r={active ? 5 : dense ? 3 : 4}
                  fill={active ? theme.colors.surface : line}
                  stroke={line}
                  strokeWidth={active ? 2.5 : 0}
                />
                <SvgText
                  {...textFor(active)}
                  x={x(index)}
                  y={pointY > 20 ? pointY - 10 : pointY + 18}
                  fontSize={10}
                  textAnchor={anchorFor(x(index), width)}
                >
                  {formatValue(point.value)}
                </SvgText>
              </G>
            );
          })}
          {layout.ticks.map((index) => {
            const point = points[index];
            const anchor = dense ? anchorFor(x(index), width) : 'middle';
            return (
              <G key={index}>
                <SvgText
                  {...textFor(index === ringed)}
                  x={x(index)}
                  y={layout.labelY}
                  fontSize={dense ? 11 : 12}
                  textAnchor={anchor}
                >
                  {point.label}
                </SvgText>
                {point.sublabel ? (
                  <SvgText
                    x={x(index)}
                    y={layout.labelY + 14}
                    fontSize={10}
                    fontFamily={fontFamily.regular}
                    fill={theme.colors.textTertiary}
                    textAnchor={anchor}
                  >
                    {point.sublabel}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
      {onSelect && width > 0 ? (
        <PointButtons
          names={points.map((point) => `${point.name}: ${formatValue(point.value)}`)}
          selected={selected}
          width={layout.step}
          onSelect={onSelect}
        />
      ) : width > 0 && points.length > 1 ? (
        <HitColumns
          count={points.length}
          left={dense ? x(0) - layout.step / 2 : 0}
          width={dense ? layout.step * points.length : width}
          onActive={setTouched}
        />
      ) : null}
    </View>
  );
}
