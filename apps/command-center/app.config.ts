import type { ExpoConfig } from 'expo/config';

// Only EXPO_PUBLIC_* variables may be read in app code; they are embedded in the client
// bundle. Server secrets belong in Supabase Edge Function secrets, never here.
// EAS_PROJECT_ID and EXPO_OWNER (not secret) link the phone builds to the owner's Expo
// project; they are set in EAS, not in this file. See docs/features/MOBILE.md.
const projectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Ledgerly',
  slug: 'ledgerly',
  scheme: 'ledgerly',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  ...(projectId ? { extra: { eas: { projectId } } } : {}),
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.stoicbytes.ledgerly',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.stoicbytes.ledgerly',
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
    // build-time render cannot know (it would always hydrate with mismatches). The public
    // portfolio, which needs server rendering, is a separate app (apps/portfolio).
    output: 'single',
    bundler: 'metro',
  },
  plugins: [
    ['expo-router', { asyncRoutes: { web: true, default: 'development' } }],
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
