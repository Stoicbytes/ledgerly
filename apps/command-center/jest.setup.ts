// Component tests render with React Native's own Animated (no native modules needed).
import * as sampleData from '@/features/preview/sampleData';
import { provideSamples } from '@/features/preview/samples';

// The app loads the preview's sample data with import(); tests have it from the start.
provideSamples(sampleData);
