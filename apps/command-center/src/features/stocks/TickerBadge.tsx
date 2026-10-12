import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** Coloured monogram tile for a ticker (fictional sample companies). */
export function TickerBadge({
  ticker,
  tint,
  size = 36,
}: {
  ticker: string;
  tint: number;
  size?: number;
}) {
  const theme = useTheme();
  const colors = theme.colors.tints[tint % theme.colors.tints.length];
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
      }}
    >
      <Text variant="caption" style={{ color: colors.fg, fontSize: size * 0.3 }}>
        {ticker.slice(0, 2)}
      </Text>
    </View>
  );
}
