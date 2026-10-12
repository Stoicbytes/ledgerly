import { View } from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '@/theme';

export type TooltipRow = { label: string; value: string; color?: string };

type ChartTooltipProps = { title: string; rows: TooltipRow[]; x: number; containerWidth: number };

/** Floating details card for the hovered/pressed data point (visual only). */
export function ChartTooltip({ title, rows, x, containerWidth }: ChartTooltipProps) {
  const theme = useTheme();
  const width = 156;
  const left = Math.min(Math.max(0, x - width / 2), Math.max(0, containerWidth - width));
  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left,
        width,
        zIndex: 20,
        padding: theme.space[3],
        gap: 4,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.inverseSurface,
        ...theme.elevation(2),
      }}
    >
      <Text variant="caption" color="onInverseSurface">
        {title}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {row.color ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.color }} />
          ) : null}
          <Text variant="caption" color="onInverseSurface" style={{ flex: 1, opacity: 0.8 }}>
            {row.label}
          </Text>
          <Text variant="caption" color="onInverseSurface" numeric>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
