import { View } from 'react-native';
import { Money, Text, type MoneyTone } from '@/components/ui';
import type { PriceSource } from '@/lib/domain/investments';
import { useTheme } from '@/theme';

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  amfi: 'AMFI',
  exchange: 'exchange',
  manual: 'entered by hand',
  'last entry': 'from your last entry',
};

export type SummaryItem = {
  label: string;
  /** Paise, formatted as money. */
  money?: number;
  tone?: MoneyTone;
  text?: string;
  note?: string;
};

/** Label-over-value tiles for a holding's numbers (two or four per row). */
export function SummaryGrid({ items }: { items: SummaryItem[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.space[3] }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            width: '50%',
            minWidth: 140,
            flexGrow: 1,
            flexBasis: '25%',
            gap: 2,
            paddingRight: theme.space[3],
          }}
        >
          <Text variant="caption" color="textTertiary" uppercase>
            {item.label}
          </Text>
          {item.money !== undefined ? (
            <Money value={item.money} variant="bodyStrong" tone={item.tone ?? 'neutral'} />
          ) : (
            <Text variant="bodyStrong" numeric>
              {item.text ?? '—'}
            </Text>
          )}
          {item.note ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
