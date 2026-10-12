import { Link, usePathname, type Href } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import { Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator';
import { useTheme } from '@/theme';
import { isActive, topNav, type Destination } from './navigation';

/** Primary navigation pills with an ink indicator that springs to the active page. */
export function TopNav({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const pathname = usePathname();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const active = topNav.find((item) => isActive(pathname, item.href));
  const indicator = useSlidingIndicator(active ? layouts[active.name] : undefined, 'spring');

  return (
    <View
      role="navigation"
      aria-label="Primary"
      style={{
        flexDirection: 'row',
        padding: 5,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Animated.View
        aria-hidden
        style={[
          {
            position: 'absolute',
            top: 5,
            bottom: 5,
            left: 0,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.ink,
          },
          {
            opacity: indicator.visible ? 1 : 0,
            width: indicator.width,
            transform: [{ translateX: indicator.x }],
          },
        ]}
      />
      {topNav.map((item) => (
        <TopNavItem
          key={item.name}
          item={item}
          compact={compact}
          active={item === active}
          onLayout={(layout) => setLayouts((current) => ({ ...current, [item.name]: layout }))}
        />
      ))}
    </View>
  );
}

function TopNavItem({
  item,
  active,
  compact,
  onLayout,
}: {
  item: Destination;
  active: boolean;
  compact: boolean;
  onLayout: (layout: LayoutRectangle) => void;
}) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <View onLayout={(event) => onLayout(event.nativeEvent.layout)}>
      <Link href={item.href as Href} asChild>
        <Pressable
          aria-current={active ? 'page' : undefined}
          accessibilityState={{ selected: active }}
          accessibilityLabel={item.label}
          {...handlers}
          style={StyleSheet.flatten([
            {
              height: 34,
              justifyContent: 'center',
              paddingHorizontal: compact ? theme.space[3] : theme.space[5],
              borderRadius: theme.radius.pill,
              backgroundColor: hovered && !active ? theme.colors.surfaceMuted : 'transparent',
            },
            focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
          ])}
        >
          <Text
            variant={active ? 'bodyStrong' : 'body'}
            color={active ? 'onInk' : 'textSecondary'}
            numberOfLines={1}
          >
            {compact ? (item.shortLabel ?? item.label) : item.label}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
