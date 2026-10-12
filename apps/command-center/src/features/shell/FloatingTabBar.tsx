import { Link, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appear, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { isActive, mobileMore, mobileTabs } from './navigation';

/**
 * Phone navigation: a floating ink bar whose active tab expands into an inverted
 * pill with its label. Adding entries lives on each section's own page.
 */
export function FloatingTabBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const moreActive = mobileMore.some((item) => isActive(pathname, item.href));
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + theme.space[3],
        flexDirection: 'row',
        paddingHorizontal: theme.space[3],
      }}
    >
      <View
        role="navigation"
        aria-label="Main"
        style={{
          flex: 1,
          height: 54,
          borderRadius: 27,
          paddingHorizontal: 6,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.ink,
          ...theme.elevation(3),
        }}
      >
        {mobileTabs.map((item) => {
          const active =
            item.name === 'more'
              ? moreActive || isActive(pathname, item.href)
              : isActive(pathname, item.href);
          return (
            <Link key={item.name} href={item.href as Href} asChild>
              <Pressable
                accessibilityLabel={item.label}
                aria-current={active ? 'page' : undefined}
                accessibilityState={{ selected: active }}
                style={StyleSheet.flatten({
                  height: 44,
                  minWidth: 44,
                  paddingHorizontal: active ? 14 : 0,
                  borderRadius: 22,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: active ? theme.colors.onInk : 'transparent',
                })}
              >
                <item.icon
                  size={20}
                  color={active ? theme.colors.textPrimary : theme.colors.onInkMuted}
                  strokeWidth={2}
                />
                {active ? (
                  <Appear duration={200}>
                    <Text variant="label" color="textPrimary" numberOfLines={1}>
                      {item.shortLabel ?? item.label}
                    </Text>
                  </Appear>
                ) : null}
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}
