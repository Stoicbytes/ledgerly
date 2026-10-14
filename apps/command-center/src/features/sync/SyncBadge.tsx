import { View } from 'react-native';
import { Cloud, CloudOff } from '@/components/icons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { useSyncStatus, type SyncStatus } from './syncStatus';

const labels: Record<Exclude<SyncStatus, 'off'>, string> = {
  loading: 'Loading…',
  loadFailed: 'Could not load',
  saved: 'Saved',
  saving: 'Saving…',
  retrying: 'Offline · will retry',
  expired: 'Signed out — sign in again to save',
};

/**
 * Save state of the signed-in user's data (replaces the preview badge). Refused changes
 * and conflicts are explained by SyncNotices, which stay until dismissed.
 */
export function SyncBadge() {
  const theme = useTheme();
  const status = useSyncStatus((state) => state.status);
  if (status === 'off') return null;
  const problem = status === 'retrying' || status === 'loadFailed' || status === 'expired';
  const label = labels[status];
  const Icon = problem ? CloudOff : Cloud;
  return (
    <View
      role="status"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: theme.radius.pill,
        backgroundColor: problem ? theme.colors.warningSoft : theme.colors.surfaceMuted,
      }}
    >
      <Icon size={13} color={problem ? theme.colors.warning : theme.colors.textSecondary} />
      <Text variant="caption" color={problem ? 'warning' : 'textSecondary'}>
        {label}
      </Text>
    </View>
  );
}
