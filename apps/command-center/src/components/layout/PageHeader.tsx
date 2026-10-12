import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { Appear } from '../ui/Appear';
import { Heading, Text } from '../ui/Text';

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  /** Badge row under the title (e.g. sample-data notice). */
  meta?: ReactNode;
  actions?: ReactNode;
  /** `hero` = large greeting; `compact` = single-line header for fit pages. */
  size?: 'hero' | 'default' | 'compact';
};

export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  actions,
  size = 'default',
}: PageHeaderProps) {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const titleVariant =
    size === 'hero' ? (isMobile ? 'h2' : 'display') : size === 'compact' ? 'h2' : 'h1';
  return (
    <Appear
      duration={300}
      style={{
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'flex-end',
        justifyContent: 'space-between',
        gap: theme.space[3],
      }}
    >
      <View style={{ flex: 1, gap: size === 'compact' ? 2 : theme.space[1] }}>
        {eyebrow ? (
          <Text variant="eyebrow" color="textSecondary" uppercase>
            {eyebrow}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[3],
            flexWrap: 'wrap',
          }}
        >
          <Heading level={1} variant={titleVariant}>
            {title}
          </Heading>
          {size === 'compact' ? meta : null}
        </View>
        {description && !isMobile ? <Text color="textSecondary">{description}</Text> : null}
        {size !== 'compact' && meta ? (
          <View style={{ marginTop: theme.space[1] }}>{meta}</View>
        ) : null}
      </View>
      {actions ? (
        <View
          style={{
            flexDirection: 'row',
            gap: theme.space[2],
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {actions}
        </View>
      ) : null}
    </Appear>
  );
}
