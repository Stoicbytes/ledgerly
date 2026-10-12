import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from '@/components/icons';
import { TooltipBubble } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useTheme } from '@/theme';

/** Rail buttons stay ≥ 40pt; the rail itself has room around them. */
const RAIL_BUTTON = 40;

type RailLinkProps = { href: string; label: string; icon: LucideIcon; active: boolean };

/** Round icon link for the floating rail; the active page is an ink circle. */
export function RailLink({ href, label, icon: Icon, active }: RailLinkProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <View>
      <Link href={href as Href} asChild>
        <Pressable
          accessibilityLabel={label}
          aria-current={active ? 'page' : undefined}
          accessibilityState={{ selected: active }}
          {...handlers}
          style={StyleSheet.flatten([
            {
              width: RAIL_BUTTON,
              height: RAIL_BUTTON,
              borderRadius: RAIL_BUTTON / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active
                ? theme.colors.ink
                : hovered
                  ? theme.colors.surfaceMuted
                  : 'transparent',
            },
            focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
          ])}
        >
          <Icon
            size={20}
            color={active ? theme.colors.onInk : theme.colors.textPrimary}
            strokeWidth={1.9}
          />
        </Pressable>
      </Link>
      {hovered || focused ? <TooltipBubble label={label} /> : null}
    </View>
  );
}
