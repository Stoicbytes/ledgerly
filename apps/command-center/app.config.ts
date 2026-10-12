import type { ExpoConfig } from 'expo/config';

// Only EXPO_PUBLIC_* variables may be read here or in app code; they are embedded in the
// client bundle. Server secrets belong in Supabase Edge Function secrets, never here.
const config: ExpoConfig = {
  name: 'Ledgerly',
  slug: 'ledgerly',
  scheme: 'ledgerly',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: { supportsTablet: true },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0B0D10',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    // Single-page output: the dashboard's layout depends on window width, which a
    // build-time render cannot know (it would always hydrate with mismatches).
    // Revisit when the public portfolio is ported and needs pre-rendering for SEO.
    output: 'single',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Attach receipt photos to your transactions.',
        cameraPermission: 'Take receipt photos for your transactions.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
