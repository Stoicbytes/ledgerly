import { View } from 'react-native';
import { Sparkles } from '@/components/icons';
import { Text } from '@/components/ui';
import { SyncBadge } from '@/features/sync/SyncBadge';
import { isCloudActive, useSyncStatus } from '@/features/sync/syncStatus';
import { useTheme } from '@/theme';
import {
  PREVIEW_STORE_DESCRIPTION,
  PREVIEW_STORE_LABEL,
  SAMPLE_DATA_DESCRIPTION,
  SAMPLE_DATA_LABEL,
} from './notice';

/**
 * Shown on every screen that renders preview data, so it is never mistaken for
 * real data. `editable` marks screens where entries can be changed in memory.
 */
export function SampleDataBadge({ editable = false }: { editable?: boolean }) {
  const theme = useTheme();
  const cloud = useSyncStatus((state) => isCloudActive(state.status));
  // Signed in: the data is the user's own. Editable screens show its save state instead;
  // read-only screens (Reports) show nothing.
  if (cloud) return editable ? <SyncBadge /> : null;
  return (
    <View
      accessible
      accessibilityLabel={editable ? PREVIEW_STORE_DESCRIPTION : SAMPLE_DATA_DESCRIPTION}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.warningSoft,
      }}
    >
      <Sparkles size={13} color={theme.colors.warning} strokeWidth={2.2} />
      <Text variant="caption" color="warning">
        {editable ? PREVIEW_STORE_LABEL : `${SAMPLE_DATA_LABEL} · design preview`}
      </Text>
    </View>
  );
}
