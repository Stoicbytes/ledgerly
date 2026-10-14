import { View } from 'react-native';
import { Cloud, CloudOff } from '@/components/icons';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { useSyncStatus } from './syncStatus';

/**
 * What saving could not do (a refused change, a newer version from another device,
 * changes put back from the last visit). Each stays until dismissed, so it is not
 * missed the way a short toast can be.
 */
export function SyncNotices() {
  const theme = useTheme();
  const notices = useSyncStatus((state) => state.notices);
  const dismiss = useSyncStatus((state) => state.dismiss);
  if (!notices.length) return null;
  return (
    <View role="status" aria-live="polite" style={{ gap: theme.space[2] }}>
      {notices.map((notice) => {
        const warning = notice.tone === 'warning';
        const Icon = warning ? CloudOff : Cloud;
        return (
          <View
            key={notice.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[3],
              paddingVertical: theme.space[2],
              paddingLeft: theme.space[3],
              paddingRight: theme.space[2],
              borderRadius: theme.radius.md,
              backgroundColor: warning ? theme.colors.warningSoft : theme.colors.infoSoft,
            }}
          >
            <Icon size={16} color={warning ? theme.colors.warning : theme.colors.info} />
            <Text variant="caption" style={{ flex: 1 }}>
              {notice.message}
            </Text>
            <Button
              label="Dismiss"
              variant="ghost"
              size="sm"
              accessibilityLabel={`Dismiss: ${notice.message}`}
              onPress={() => dismiss(notice.id)}
            />
          </View>
        );
      })}
    </View>
  );
}
