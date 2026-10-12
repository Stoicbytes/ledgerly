import { View } from 'react-native';
import { Smartphone } from '@/components/icons';
import { Card, CardHeader, CategoryIcon, SegmentedControl, Text } from '@/components/ui';
import { type IdleChoice } from '@/features/auth/idle';
import { KeepSignedInCheck } from '@/features/auth/KeepSignedInCheck';
import { canChooseKeepSignedIn } from '@/lib/data/authStorage';
import { useDevicePrefs } from '@/state/devicePrefs';
import { useTheme } from '@/theme';

const idleSegments = [
  { value: 'auto', label: 'Auto' },
  { value: '15', label: '15 min' },
  { value: '60', label: '1 hour' },
  { value: '480', label: '8 hours' },
  { value: 'never', label: 'Never' },
] as const satisfies readonly { value: IdleChoice; label: string }[];

/** How this device keeps you signed in: session lifetime and automatic sign-out. */
export function DeviceSignInCard({ index }: { index: number }) {
  const theme = useTheme();
  const keep = useDevicePrefs((state) => state.keepSignedIn);
  const choice = useDevicePrefs((state) => state.idleChoice);
  const setChoice = useDevicePrefs((state) => state.setIdleChoice);
  const auto = keep
    ? 'Auto: stays signed in on this device, which you marked as your own.'
    : 'Auto: signs out after 30 minutes without activity.';
  return (
    <Card index={index} style={{ gap: theme.space[3] }}>
      <CardHeader
        title="This device"
        subtitle="Saved on this device only"
        action={<CategoryIcon icon={Smartphone} tint={1} size={40} />}
      />
      {canChooseKeepSignedIn ? <KeepSignedInCheck /> : null}
      <View style={{ gap: theme.space[2] }}>
        <Text variant="bodyStrong">Sign out after inactivity</Text>
        <SegmentedControl
          size="sm"
          segments={idleSegments}
          value={choice}
          onChange={setChoice}
          accessibilityLabel="Sign out after inactivity"
        />
        <Text variant="caption" color="textTertiary">
          {choice === 'auto'
            ? auto
            : choice === 'never'
              ? 'Never signs out on its own. Lock your device when you leave it.'
              : 'A warning appears two minutes before.'}
        </Text>
      </View>
    </Card>
  );
}
