import { Pressable, View } from 'react-native';
import { ChevronRight } from '@/components/icons';
import { Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import type { Slice } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { fontFamily, useTheme } from '@/theme';

/** "34%" — shares under 1% read "<1%" rather than a misleading "0%". */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.01) return '<1%';
  return `${Math.round(share * 100)}%`;
}

type SliceRowProps = {
  slice: Slice;
  color: string;
  /** Drill into the category; omitted for buckets that have no category. */
  onPress?: () => void;
  active?: boolean;
  /** The focused row (Stats › category › subcategory); announced as selected. */
  selected?: boolean;
  onHover?: (id: string | null) => void;
};

/** Ranked category row (Money Manager style): share badge in the slice colour, name and amount. */
export function SliceRow({
  slice,
  color,
  onPress,
  active = false,
  selected,
  onHover,
}: SliceRowProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const highlighted = active || hovered;
  return (
    <Pressable
      role={onPress ? 'button' : undefined}
      accessibilityState={selected === undefined ? undefined : { selected }}
      disabled={!onPress}
      accessibilityLabel={`${slice.name}: ${formatMoneyWhole(slice.amount)}, ${formatShare(slice.share)}, ${slice.count} ${slice.count === 1 ? 'entry' : 'entries'}`}
      onPress={onPress}
      onHoverIn={() => {
        handlers.onHoverIn();
        onHover?.(slice.name);
      }}
      onHoverOut={() => {
        handlers.onHoverOut();
        onHover?.(null);
      }}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          paddingVertical: 6,
          paddingHorizontal: theme.space[2],
          borderRadius: theme.radius.md,
          backgroundColor: highlighted ? theme.colors.surfaceMuted : 'transparent',
          borderWidth: 1,
          borderColor: selected ? theme.colors.borderStrong : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <View
        style={{
          width: 44,
          alignItems: 'center',
          paddingVertical: 3,
          borderRadius: theme.radius.xs,
          backgroundColor: color,
        }}
      >
        <Text
          variant="caption"
          numeric
          style={{ color: theme.colors.onPie, fontFamily: fontFamily.semibold }}
        >
          {formatShare(slice.share)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" numberOfLines={1}>
          {slice.name}
        </Text>
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {slice.count} {slice.count === 1 ? 'entry' : 'entries'}
        </Text>
      </View>
      <Text variant="label" numeric style={{ minWidth: 76, textAlign: 'right' }} numberOfLines={1}>
        {formatMoneyWhole(slice.amount)}
      </Text>
      {onPress ? <ChevronRight size={16} color={theme.colors.textTertiary} /> : null}
    </Pressable>
  );
}
