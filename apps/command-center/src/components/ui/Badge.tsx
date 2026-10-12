import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type BadgeTone =
  'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'investment';

const toneRoles = {
  neutral: ['surfaceMuted', 'textSecondary'],
  accent: ['accentSoft', 'accent'],
  success: ['successSoft', 'success'],
  warning: ['warningSoft', 'warning'],
  danger: ['dangerSoft', 'danger'],
  info: ['infoSoft', 'info'],
  investment: ['investmentSoft', 'investment'],
} as const;

/** Small status label. Always carries text, so meaning never depends on colour. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const [bg, fg] = toneRoles[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.colors[bg],
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.space[2] + 2,
        paddingVertical: 3,
      }}
    >
      <Text variant="caption" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
