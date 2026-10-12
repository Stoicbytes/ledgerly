import { View } from 'react-native';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { Card, CardHeader, Text } from '@/components/ui';
import { useTween } from '@/hooks/useTween';
import type { Slice } from '@/lib/domain/investments';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

/** Sector weights as colourful horizontal bars. */
export function SectorCard({ sectors, style }: { sectors: Slice[]; style?: object }) {
  const theme = useTheme();
  const total = sectors.reduce((sum, item) => sum + item.value, 0);
  const progress = useTween(sectors.length, 900);
  return (
    <Card index={6} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader
        title="Sectors"
        subtitle={`${sectors.length} sectors · ${formatMoneyWhole(total)}`}
      />
      <PanelScroll gap={theme.space[3]}>
        {sectors.length ? null : (
          <Text variant="caption" color="textTertiary">
            Set a sector on each stock to see how your money is spread.
          </Text>
        )}
        {sectors.map((item, index) => (
          <View
            key={item.label}
            accessible
            accessibilityLabel={`${item.label}: ${Math.round(item.share)} percent`}
            style={{ gap: 6 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label">{item.label}</Text>
              <Text variant="label" color="textSecondary" numeric>
                {Math.round(item.share)}%
              </Text>
            </View>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.colors.surfaceMuted,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${item.share * progress}%`,
                  height: '100%',
                  borderRadius: 5,
                  backgroundColor: theme.colors.chart[index % theme.colors.chart.length],
                }}
              />
            </View>
          </View>
        ))}
      </PanelScroll>
    </Card>
  );
}
