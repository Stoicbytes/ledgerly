import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { Heading, Text } from './Text';

type CardHeaderProps = { title: string; subtitle?: string; action?: ReactNode; inverse?: boolean };

/** Title row inside a card. */
export function CardHeader({ title, subtitle, action, inverse = false }: CardHeaderProps) {
  const theme = useTheme();
  // Subtitles are supplementary; drop them when vertical space is tight.
  const { isDense } = useBreakpoint();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Heading
          level={2}
          variant="title"
          color={inverse ? 'onBrand' : 'textPrimary'}
          numberOfLines={1}
        >
          {title}
        </Heading>
        {subtitle && !isDense ? (
          <Text
            variant="label"
            color={inverse ? 'onBrandMuted' : 'textSecondary'}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
