import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

/**
 * Draws the enrolment QR code from Supabase's SVG markup. Always dark on white, in
 * both themes, so authenticator apps can read it; drawn in-app rather than as an
 * image URL, so it needs no extra Content-Security-Policy source.
 */
export function QrCode({ svg, size = 184 }: { svg: string; size?: number }) {
  // Square modules without anti-aliased seams scan more reliably.
  const crisp = /shape-rendering=/i.test(svg)
    ? svg
    : svg.replace(/<svg\b/i, '<svg shape-rendering="crispEdges"');
  return (
    <View
      role="img"
      aria-label="QR code for your authenticator app"
      style={{ alignSelf: 'center', padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF' }}
    >
      <SvgXml xml={crisp} width={size} height={size} color="#000000" />
    </View>
  );
}
