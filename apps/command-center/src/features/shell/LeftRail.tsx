import { usePathname } from 'expo-router';
import { View } from 'react-native';
import { Sparkles } from '@/components/icons';
import { useTheme } from '@/theme';
import { isActive, railFooterNav, railNav } from './navigation';
import { RailLink } from './RailLink';
import { ThemeCapsule } from './ThemeToggle';

/** Floating vertical rail: theme capsule, secondary destinations, settings. */
export function LeftRail() {
  const theme = useTheme();
  const pathname = usePathname();
  const pill = {
    padding: 6,
    gap: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  } as const;
  return (
    <View role="navigation" aria-label="Secondary" style={{ gap: theme.space[4], zIndex: 10 }}>
      <ThemeCapsule />
      <View style={pill}>
        {railNav.map((item) => (
          <RailLink
            key={item.name}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href)}
          />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View style={pill}>
        {__DEV__ ? (
          <RailLink
            href="/dev/components"
            label="Component gallery (dev)"
            icon={Sparkles}
            active={false}
          />
        ) : null}
        {railFooterNav.map((item) => (
          <RailLink
            key={item.name}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href)}
          />
        ))}
      </View>
    </View>
  );
}
