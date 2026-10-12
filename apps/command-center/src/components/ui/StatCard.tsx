import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from '../icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { Card } from './Card';
import { Delta } from './Delta';
import { Money } from './Money';
import { Text } from './Text';

type StatCardProps = {
  label: string;
  /** Integer paise, or a preformatted string (e.g. a percentage). */
  value: number | string;
  icon: LucideIcon;
  delta?: number;
  goodWhen?: 'up' | 'down';
  caption?: string;
  /** `brand` = graphite gradient hero tile (use once per row). */
  variant?: 'default' | 'brand';
  index?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** KPI tile: label + icon, a large figure (counts up), and a change pill. */
export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  goodWhen = 'up',
  caption = 'this month',
  variant = 'default',
  index,
  compact = false,
  style,
}: StatCardProps) {
  const theme = useTheme();
  const brand = variant === 'brand';
  const { isDense } = useBreakpoint();
  const figure =
    typeof value === 'number' ? (
      <Money
        value={value}
        animate
        variant="figureSm"
        color={brand ? 'onBrand' : 'textPrimary'}
        numberOfLines={1}
      />
    ) : (
      <Text variant="figureSm" color={brand ? 'onBrand' : 'textPrimary'} numeric numberOfLines={1}>
        {value}
      </Text>
    );

  if (isDense) {
    // Short desktop windows: label + change on one line, figure below, no icon.
    return (
      <Card
        variant={brand ? 'brand' : 'default'}
        index={index}
        padding={4}
        style={[{ justifyContent: 'center', gap: theme.space[2] }, style]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Text
            variant="label"
            color={brand ? 'onBrand' : 'textSecondary'}
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {delta !== undefined ? (
            <Delta value={delta} goodWhen={goodWhen} variant={brand ? 'onBrand' : 'pill'} />
          ) : null}
        </View>
        {figure}
      </Card>
    );
  }
  return (
    <Card
      variant={brand ? 'brand' : 'default'}
      index={index}
      padding={compact ? 4 : 5}
      style={[
        { justifyContent: 'space-between', gap: compact ? theme.space[2] : theme.space[4] },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Text
          variant={compact ? 'label' : 'body'}
          color={brand ? 'onBrand' : 'textSecondary'}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View
          aria-hidden
          style={{
            width: compact ? 32 : 36,
            height: compact ? 32 : 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: brand ? 'rgba(255,255,255,0.16)' : theme.colors.surfaceMuted,
          }}
        >
          <Icon
            size={compact ? 16 : 18}
            color={brand ? theme.colors.onBrand : theme.colors.textPrimary}
            strokeWidth={2}
          />
        </View>
      </View>
      <View style={{ gap: theme.space[1] }}>
        {typeof value === 'number' ? (
          <Money
            value={value}
            animate
            whole={compact}
            variant={compact ? 'figureSm' : 'figure'}
            color={brand ? 'onBrand' : 'textPrimary'}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        ) : (
          <Text
            variant={compact ? 'figureSm' : 'figure'}
            color={brand ? 'onBrand' : 'textPrimary'}
            numeric
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        {delta !== undefined ? (
          <Delta
            value={delta}
            goodWhen={goodWhen}
            comparison={caption}
            variant={brand ? 'onBrand' : 'pill'}
          />
        ) : caption ? (
          <Text variant="caption" color={brand ? 'onBrandMuted' : 'textSecondary'}>
            {caption}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
