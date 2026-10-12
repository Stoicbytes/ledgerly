import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from '@/components/icons';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { CategoryIcon, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { mobileMore } from './navigation';

/** Phone overflow navigation as colourful tiles. */
export function MoreScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <PageHeader title="More" />
      <ResponsiveGrid columns={{ sm: 2, md: 3 }}>
        {mobileMore.map((item, index) => (
          <Link key={item.name} href={item.href as Href} asChild>
            <Pressable
              accessibilityLabel={item.label}
              style={StyleSheet.flatten({
                padding: theme.space[4],
                gap: theme.space[4],
                borderRadius: theme.radius.xl,
                backgroundColor: theme.colors.surface,
              })}
            >
              <CategoryIcon icon={item.icon} tint={index + 1} size={44} />
              <Text variant="bodyStrong">{item.label}</Text>
              <ChevronRight
                size={16}
                color={theme.colors.textTertiary}
                style={{ position: 'absolute', top: 16, right: 16 }}
              />
            </Pressable>
          </Link>
        ))}
      </ResponsiveGrid>
    </Screen>
  );
}
