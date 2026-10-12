import { View } from 'react-native';
import { Monitor, Moon, Sun } from '@/components/icons';
import { IconButton } from '@/components/ui';
import { useUiStore, type ThemePreference } from '@/state/ui';
import { useTheme } from '@/theme';

const next: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};
const icons = { system: Monitor, light: Sun, dark: Moon } as const;

/** Single button cycling System → Light → Dark (mobile header). */
export function ThemeToggle({ variant = 'surface' }: { variant?: 'surface' | 'plain' }) {
  const preference = useUiStore((state) => state.themePreference);
  const setPreference = useUiStore((state) => state.setThemePreference);
  return (
    <IconButton
      icon={icons[preference]}
      variant={variant}
      accessibilityLabel={`Theme: ${preference}. Switch to ${next[preference]}`}
      onPress={() => setPreference(next[preference])}
    />
  );
}

/** Sun / moon capsule at the top of the desktop rail (reference design). */
export function ThemeCapsule() {
  const theme = useTheme();
  const setPreference = useUiStore((state) => state.setThemePreference);
  return (
    <View
      role="radiogroup"
      accessibilityLabel="Colour theme"
      style={{
        padding: 6,
        gap: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
      }}
    >
      <IconButton
        icon={Sun}
        role="radio"
        accessibilityState={{ checked: theme.scheme === 'light' }}
        accessibilityLabel="Light theme"
        selected={theme.scheme === 'light'}
        tooltip="right"
        onPress={() => setPreference('light')}
      />
      <IconButton
        icon={Moon}
        role="radio"
        accessibilityState={{ checked: theme.scheme === 'dark' }}
        accessibilityLabel="Dark theme"
        selected={theme.scheme === 'dark'}
        tooltip="right"
        onPress={() => setPreference('dark')}
      />
    </View>
  );
}
