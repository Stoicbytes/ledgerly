import { View } from 'react-native';
import { GradientFill, Text } from '@/components/ui';
import { BRAND } from '@/branding';
import { useTheme } from '@/theme';

/** Gradient roundel with a white monogram; optional wordmark. */
export function BrandMark({ size = 40, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
      <View
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GradientFill from={theme.colors.brandFrom} to={theme.colors.brandTo} />
        <Text
          variant="title"
          style={{ color: theme.colors.onBrand, fontSize: size * 0.48, lineHeight: size * 0.6 }}
        >
          {BRAND.name[0]}
        </Text>
      </View>
      {wordmark ? (
        <Text variant="title" numberOfLines={1}>
          {BRAND.name}
        </Text>
      ) : null}
    </View>
  );
}
