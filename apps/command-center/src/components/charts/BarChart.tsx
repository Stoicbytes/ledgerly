import { useId, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { useTween } from '@/hooks/useTween';
import { fontFamily, useTheme } from '@/theme';
import { ChartTooltip } from './ChartTooltip';
import { HitColumns } from './HitColumns';
import { niceMax, ticks } from './scales';
import { useChartSize } from './useChartSize';

export type BarDatum = {
  label: string;
  values: number[];
  /** Incomplete period: drawn hatched. */ projected?: boolean;
};
export type BarSeries = { name: string; color: string };

type BarChartProps = {
  data: BarDatum[];
  series: BarSeries[];
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  /** Text alternative describing what the chart shows. */
  accessibilityLabel: string;
  /** Fixed height; omit to fill the parent (fit layouts). */
  height?: number;
};

const AXIS = 40;
const BOTTOM = 22;
const TOP = 8;

/** Grouped pill bars (e.g. income vs expenses per month). */
export function BarChart({
  data,
  series,
  formatValue,
  formatAxis,
  accessibilityLabel,
  height,
}: BarChartProps) {
  const theme = useTheme();
  const { width, height: measured, onLayout } = useChartSize();
  const [active, setActive] = useState<number | null>(null);
  const progress = useTween(data.length, 900);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const chartHeight = height ?? measured;
  const plotWidth = Math.max(0, width - AXIS);
  const plotHeight = Math.max(0, chartHeight - BOTTOM - TOP);
  const max = niceMax(Math.max(1, ...data.flatMap((datum) => datum.values)));
  const groupWidth = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.max(6, Math.min(16, (groupWidth * 0.5) / Math.max(1, series.length)));
  const gap = Math.min(5, barWidth * 0.35);
  const y = (value: number) => TOP + plotHeight - (value / max) * plotHeight;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={height ? { height } : { flex: 1, minHeight: 140 }}
    >
      {width > 0 && chartHeight > 0 ? (
        <Svg width={width} height={chartHeight} aria-hidden>
          <Defs>
            {series.map((item, index) => (
              <Pattern
                key={item.name}
                id={`p${id}${index}`}
                width={6}
                height={6}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <Rect width={6} height={6} fill={theme.colors.surfaceMuted} />
                <Line x1={0} y1={0} x2={0} y2={6} stroke={item.color} strokeWidth={2.5} />
              </Pattern>
            ))}
          </Defs>
          {ticks(max).map((tick) => (
            <G key={tick}>
              <Line
                x1={AXIS}
                x2={width}
                y1={y(tick)}
                y2={y(tick)}
                stroke={theme.colors.chartGrid}
                strokeDasharray="4 4"
              />
              <SvgText
                x={0}
                y={y(tick) + 4}
                fontSize={11}
                fontFamily={fontFamily.regular}
                fill={theme.colors.textTertiary}
              >
                {formatAxis(tick)}
              </SvgText>
            </G>
          ))}
          {data.map((datum, groupIndex) => {
            const groupX = AXIS + groupIndex * groupWidth;
            const total = series.length * barWidth + (series.length - 1) * gap;
            return (
              <G key={datum.label}>
                {active === groupIndex ? (
                  <Rect
                    x={groupX + 4}
                    y={TOP}
                    width={groupWidth - 8}
                    height={plotHeight}
                    rx={12}
                    fill={theme.colors.surfaceMuted}
                  />
                ) : null}
                {datum.values.map((value, seriesIndex) => {
                  const barHeight = Math.max(barWidth, (value / max) * plotHeight * progress);
                  const x = groupX + (groupWidth - total) / 2 + seriesIndex * (barWidth + gap);
                  return (
                    <Rect
                      key={series[seriesIndex]?.name ?? seriesIndex}
                      x={x}
                      y={TOP + plotHeight - barHeight}
                      width={barWidth}
                      height={barHeight}
                      rx={barWidth / 2}
                      fill={
                        datum.projected ? `url(#p${id}${seriesIndex})` : series[seriesIndex]?.color
                      }
                      stroke={datum.projected ? series[seriesIndex]?.color : undefined}
                      strokeWidth={datum.projected ? 1 : 0}
                    />
                  );
                })}
                <SvgText
                  x={groupX + groupWidth / 2}
                  y={chartHeight - 4}
                  fontSize={11}
                  fontFamily={active === groupIndex ? fontFamily.semibold : fontFamily.regular}
                  fill={
                    active === groupIndex ? theme.colors.textPrimary : theme.colors.textTertiary
                  }
                  textAnchor="middle"
                >
                  {datum.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
      <HitColumns count={data.length} left={AXIS} width={plotWidth} onActive={setActive} />
      {active !== null && data[active] ? (
        <ChartTooltip
          x={AXIS + active * groupWidth + groupWidth / 2}
          containerWidth={width}
          title={`${data[active].label}${data[active].projected ? ' (so far)' : ''}`}
          rows={series.map((item, index) => ({
            label: item.name,
            value: formatValue(data[active].values[index] ?? 0),
            color: item.color,
          }))}
        />
      ) : null}
    </View>
  );
}
