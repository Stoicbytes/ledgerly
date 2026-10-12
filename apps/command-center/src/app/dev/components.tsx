import { Redirect } from 'expo-router';
import { ComponentGallery } from '@/features/dev-gallery/ComponentGallery';

/** Development-only design-system gallery. Production builds redirect away. */
export default function ComponentsRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ComponentGallery />;
}
