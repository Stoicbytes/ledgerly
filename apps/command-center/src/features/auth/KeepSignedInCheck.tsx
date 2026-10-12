import { Pressable, View } from 'react-native';
import { Square, SquareCheck } from '@/components/icons';
import { Text } from '@/components/ui';
import { canChooseKeepSignedIn } from '@/lib/data/authStorage';
import { useDevicePrefs } from '@/state/devicePrefs';
import { useTheme } from '@/theme';

/** "Keep me signed in on this device" (web only; native apps always keep the session). */
export function KeepSignedInCheck() {
  const theme = useTheme();
  const keep = useDevicePrefs((state) => state.keepSignedIn);
  const setKeep = useDevicePrefs((state) => state.setKeepSignedIn);
  if (!canChooseKeepSignedIn) return null;
  const Icon = keep ? SquareCheck : Square;
  return (
    <Pressable
      role="checkbox"
      aria-checked={keep}
      accessibilityLabel="Keep me signed in on this device"
      onPress={() => setKeep(!keep)}
      style={{ flexDirection: 'row', gap: theme.space[2], alignItems: 'flex-start' }}
    >
      <Icon size={20} color={keep ? theme.colors.textPrimary : theme.colors.textSecondary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">Keep me signed in on this device</Text>
        <Text variant="caption" color="textTertiary">
          Only on your own phone or computer. Closing the browser will not sign you out.
        </Text>
      </View>
    </Pressable>
  );
}
