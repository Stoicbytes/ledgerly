import { Pressable, View } from 'react-native';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { Card, CardHeader, Delta, Money, Text } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useInteractionState } from '@/hooks/useInteractionState';
import { fromUnits4, type FundRow } from '@/lib/domain/investments';
import { useTheme } from '@/theme';

const columns = [
  { label: 'Fund', flex: 3 },
  { label: 'Units', flex: 1 },
  { label: 'Avg cost', flex: 1 },
  { label: 'NAV', flex: 1 },
  { label: 'Value', flex: 1.3 },
  { label: 'Gain', flex: 1.3 },
] as const;

/** Every fund with units, cost, NAV, value and gain; pressing one opens its details. */
export function HoldingsTable({
  rows,
  onOpen,
  style,
}: {
  rows: FundRow[];
  onOpen: (fundId: string) => void;
  style?: object;
}) {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  return (
    <Card index={7} padding={4} style={[{ gap: theme.space[2] }, style]}>
      <View style={{ paddingHorizontal: theme.space[1] }}>
        <CardHeader title="Holdings" subtitle={`${rows.length} funds · press one for details`} />
      </View>
      {isMobile ? null : (
        <View
          style={{
            flexDirection: 'row',
            gap: theme.space[3],
            paddingHorizontal: theme.space[2],
            paddingVertical: theme.space[2],
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          {columns.map((column, index) => (
            <Text
              key={column.label}
              variant="caption"
              color="textTertiary"
              uppercase
              style={{ flex: column.flex, textAlign: index === 0 ? 'left' : 'right' }}
            >
              {column.label}
            </Text>
          ))}
        </View>
      )}
      <PanelScroll gap={0}>
        {rows.map((row) => (
          <HoldingRow
            key={row.fund.id}
            row={row}
            mobile={isMobile}
            onPress={() => onOpen(row.fund.id)}
          />
        ))}
      </PanelScroll>
    </Card>
  );
}

function HoldingRow({
  row,
  mobile,
  onPress,
}: {
  row: FundRow;
  mobile: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const { position, quote } = row;
  const gainPct = position.invested ? (position.unrealised / position.invested) * 100 : 0;
  const right = { flex: 1, textAlign: 'right' as const };
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${row.fund.name}, open details`}
      onPress={onPress}
      {...handlers}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        paddingVertical: theme.space[2] + 2,
        paddingHorizontal: theme.space[2],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        borderRadius: focused ? theme.radius.sm : 0,
        outlineWidth: 0,
        backgroundColor: hovered || focused ? theme.colors.surfaceMuted : 'transparent',
        opacity: position.units4 ? 1 : 0.6,
      }}
    >
      <View style={{ flex: 3, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {row.fund.name}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {position.units4 ? row.categoryLabel : 'Fully redeemed'}
        </Text>
      </View>
      {mobile ? (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Money value={position.value} variant="bodyStrong" />
          <Delta value={gainPct} variant="pill" />
        </View>
      ) : (
        <>
          <Text variant="label" numeric style={right}>
            {fromUnits4(position.units4).toFixed(3)}
          </Text>
          <Text variant="label" color="textSecondary" numeric style={right}>
            {position.avgCost ? position.avgCost.toFixed(2) : '—'}
          </Text>
          <Text variant="label" numeric style={right}>
            {quote ? quote.price.toFixed(2) : '—'}
          </Text>
          <Money value={position.value} variant="label" style={{ flex: 1.3, textAlign: 'right' }} />
          <View style={{ flex: 1.3, alignItems: 'flex-end' }}>
            <Money value={position.unrealised} tone="auto" variant="label" />
            <Text variant="caption" color={position.unrealised >= 0 ? 'profit' : 'loss'} numeric>
              {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}
