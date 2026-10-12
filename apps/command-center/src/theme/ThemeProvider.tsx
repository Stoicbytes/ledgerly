import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { useUiStore } from '@/state/ui';
import { darkColors, lightColors, type ColorRoles } from './colors';
import { elevation, type ElevationLevel } from './elevation';
import { breakpoints, phoneSpace, radius, space, type SpaceScale } from './tokens';
import { phoneTypeScale, typeScale, type TypeScale } from './typography';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorRoles;
  space: SpaceScale;
  radius: typeof radius;
  type: TypeScale;
  elevation: (level: ElevationLevel) => ReturnType<typeof elevation>;
};

/** `phone` uses the denser type scale and spacing for narrow windows. */
function createTheme(scheme: ColorScheme, phone = false): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    space: phone ? phoneSpace : space,
    radius,
    type: phone ? phoneTypeScale : typeScale,
    elevation: (level) => elevation(level, scheme),
  };
}

const ThemeContext = createContext<Theme>(createTheme('light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useUiStore((state) => state.themePreference);
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const phone = useWindowDimensions().width < breakpoints.md;
  const theme = useMemo(() => createTheme(scheme, phone), [scheme, phone]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
