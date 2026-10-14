import { View } from 'react-native';
import { RotateCcw, ArchiveRestore } from '@/components/icons';
import { Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { canPickFiles } from '@/features/investments/import/pickFiles';
import { isCloudActive, useSyncStatus } from '@/features/sync/syncStatus';
import { useTheme } from '@/theme';
import { useRestore } from './useRestore';

const Lines = ({ lines }: { lines: string[] }) => (
  <>
    {lines.map((line) => (
      <Text key={line} variant="caption" color="textSecondary">
        {line}
      </Text>
    ))}
  </>
);

/** Brings back an "Export everything" file: adds what is missing, never overwrites. */
export function RestoreCard({ index }: { index: number }) {
  const theme = useTheme();
  const cloud = isCloudActive(useSyncStatus((sync) => sync.status));
  const { state, pick, approve, undo, reset } = useRestore(cloud);
  const row = { flexDirection: 'row', gap: theme.space[3], flexWrap: 'wrap' } as const;
  return (
    <Card index={index} style={{ gap: theme.space[4] }}>
      <CardHeader
        title="Restore from backup"
        subtitle="An Export everything file. Adds what is missing; nothing here is changed or deleted."
        action={<CategoryIcon icon={ArchiveRestore} tint={3} size={40} />}
      />
      {state.phase === 'review' ? (
        <View style={{ gap: theme.space[2] }}>
          <Text variant="bodyStrong">{state.file}</Text>
          <Lines lines={state.lines} />
          <View style={row}>
            {state.total ? (
              <Button
                label={`Restore ${state.total.toLocaleString('en-IN')} ${state.total === 1 ? 'record' : 'records'}`}
                onPress={() => void approve()}
              />
            ) : null}
            <Button label="Cancel" variant="secondary" onPress={reset} />
          </View>
        </View>
      ) : state.phase === 'restoring' ? (
        <Text variant="caption" color="textSecondary">
          {state.total
            ? `Saving part ${Math.min(state.saved + 1, state.total)} of ${state.total}… Keep this page open.`
            : 'Checking what is already here…'}
        </Text>
      ) : state.phase === 'done' ? (
        <View style={{ gap: theme.space[3] }}>
          <Lines lines={state.lines} />
          <View style={row}>
            <Button label="Done" variant="secondary" onPress={reset} />
            {state.result.plan.total ? (
              <Button
                label="Undo restore"
                icon={RotateCcw}
                variant="secondary"
                onPress={() => void undo()}
              />
            ) : null}
          </View>
        </View>
      ) : canPickFiles ? (
        <View style={{ gap: theme.space[2] }}>
          <Button
            label="Choose backup file"
            icon={ArchiveRestore}
            variant="secondary"
            loading={state.phase === 'reading'}
            onPress={() => void pick()}
          />
          {state.phase === 'choose' && state.notice ? (
            <Text variant="caption" color="textSecondary">
              {state.notice}
            </Text>
          ) : null}
          {state.phase === 'choose' && state.problem ? (
            <Text variant="caption" color="danger">
              {state.problem}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="caption" color="textSecondary">
          Restoring works in the web app for now.
        </Text>
      )}
    </Card>
  );
}
