import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { useTween } from '@/hooks/useTween';
import { useTheme, type ColorRoles } from '@/theme';

type ProgressTone = Extract<
  keyof ColorRoles,
  'accent' | 'primary' | 'brandFrom' | 'success' | 'warning' | 'danger' | 'investment' | 'ink'
>;

type ProgressBarProps = {
  /** 0–1; values outside are clamped. */
  value: number;
  /** Names what is measured, e.g. "Food budget used". */
  accessibilityLabel: string;
  tone?: ProgressTone;
  height?: number;
  /** Draw the remaining part with diagonal hatching (reference style). */
  hatched?: boolean;
};

export function ProgressBar({
  value,
  accessibilityLabel,
  tone = 'brandFrom',
  height = 10,
  hatched = false,
}: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(clamped * 100);
  const progress = useTween(percent, 900);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View
      role="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} percent` }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: hatched ? 'transparent' : theme.colors.surfaceMuted,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {hatched ? (
        <Svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
          aria-hidden
        >
          <Defs>
            <Pattern
              id={`h${id}`}
              width={7}
              height={7}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <Line x1={0} y1={0} x2={0} y2={7} stroke={theme.colors.hatch} strokeWidth={3} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" rx={height / 2} fill={`url(#h${id})`} />
        </Svg>
      ) : null}
      <View
        style={{
          width: `${percent * progress}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: theme.colors[tone],
        }}
      />
    </View>
  );
}
