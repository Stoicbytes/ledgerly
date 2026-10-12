import { useState } from 'react';
import { View } from 'react-native';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { DonutChart } from '@/components/charts';
import { Card, CardHeader, Text } from '@/components/ui';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

export type AllocationItem = { label: string; value: number; colorIndex: number };

/** Donut + legend; hovering a legend row highlights its segment. */
export function AllocationCard({
  title,
  subtitle,
  items,
  index = 6,
  style,
}: {
  title: string;
  subtitle: string;
  items: AllocationItem[];
  index?: number;
  style?: object;
}) {
  const theme = useTheme();
  const [active, setActive] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colored = items.map((item) => ({
    ...item,
    color: theme.colors.chart[item.colorIndex % theme.colors.chart.length],
  }));
  return (
    <Card index={index} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader title={title} subtitle={subtitle} />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[4],
          minHeight: 0,
        }}
      >
        <DonutChart
          size={140}
          thickness={16}
          activeLabel={active}
          segments={colored.map((item) => ({
            label: item.label,
            value: item.value,
            color: item.color,
          }))}
          accessibilityLabel={`${title}: ${colored.map((item) => `${item.label} ${Math.round((item.value / total) * 100)} percent`).join(', ')}.`}
        >
          <Text variant="caption" color="textSecondary">
            {items.length} groups
          </Text>
        </DonutChart>
        <PanelScroll gap={2}>
          {colored.map((item) => (
            <View
              key={item.label}
              onPointerEnter={() => setActive(item.label)}
              onPointerLeave={() => setActive(null)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: theme.radius.sm,
                backgroundColor: active === item.label ? theme.colors.surfaceMuted : 'transparent',
              }}
            >
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }}
              />
              <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                {item.label}
              </Text>
              <Text variant="label" color="textSecondary" numeric>
                {total ? Math.round((item.value / total) * 100) : 0}%
              </Text>
            </View>
          ))}
          <Text
            variant="caption"
            color="textTertiary"
            style={{ paddingHorizontal: 8, paddingTop: 4 }}
          >
            Total {formatMoneyWhole(total)}
          </Text>
        </PanelScroll>
      </View>
    </Card>
  );
}
