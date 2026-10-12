import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

type GradientFillProps = { from: string; to: string; glow?: string };

/**
 * Absolute-fill diagonal gradient (plus an optional soft glow) drawn with SVG,
 * so it renders the same on web, iOS and Android without another native module.
 * Place it as the first child of a container with `overflow: 'hidden'`.
 */
export function GradientFill({ from, to, glow }: GradientFillProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
      aria-hidden
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={`lg${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        {glow ? (
          <RadialGradient id={`rg${id}`} cx="0.85" cy="0.1" r="0.7">
            <Stop offset="0" stopColor={glow} stopOpacity={0.14} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#lg${id})`} />
      {glow ? <Rect width="100%" height="100%" fill={`url(#rg${id})`} /> : null}
    </Svg>
  );
}
