import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { RotateCcw } from '@/components/icons';
import { Sheet } from '@/components/overlays';
import { Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { isCloudActive, useSyncStatus } from '@/features/sync/syncStatus';
import { useTheme } from '@/theme';
import { RESET_OPTIONS, type ResetOption } from './resetScopes';
import { resetErrorMessage, runReset } from './runReset';

const WORD = 'RESET';

/** Settings → Reset data: clear expenses, mutual funds or stocks, after typing RESET. */
export function ResetCard({ index }: { index: number }) {
  const theme = useTheme();
  const toast = useToast();
  const cloud = isCloudActive(useSyncStatus((state) => state.status));
  const [chosen, setChosen] = useState<ResetOption | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setChosen(null);
    setTyped('');
  };
  const confirm = async () => {
    if (!chosen || typed.trim().toUpperCase() !== WORD) return;
    setBusy(true);
    try {
      toast.show({ message: await runReset(chosen, cloud) });
      setChosen(null);
      setTyped('');
    } catch (error) {
      toast.show({ message: resetErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card index={index} style={{ gap: theme.space[4] }}>
      <CardHeader
        title="Reset data"
        subtitle="Start a part of Ledgerly again from empty. Salary, PF, notes and your portfolio site are never touched."
        action={<CategoryIcon icon={RotateCcw} tint={0} size={40} />}
      />
      {RESET_OPTIONS.map((option) => (
        <View
          key={option.scope}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[3],
            flexWrap: 'wrap',
          }}
        >
          <View style={{ flex: 1, minWidth: 220, gap: 2 }}>
            <Text variant="bodyStrong">{option.title}</Text>
            <Text variant="caption" color="textSecondary">
              {option.detail}
            </Text>
          </View>
          <Button
            label={`Reset ${option.title.toLowerCase()}`}
            variant="secondary"
            size="sm"
            onPress={() => setChosen(option)}
          />
        </View>
      ))}
      <Sheet
        visible={Boolean(chosen)}
        onClose={close}
        title={chosen ? `Reset ${chosen.title.toLowerCase()}?` : ''}
        width={460}
        footer={
          <>
            <Button label="Cancel" variant="secondary" onPress={close} disabled={busy} />
            <Button
              label="Delete for good"
              variant="danger"
              loading={busy}
              disabled={typed.trim().toUpperCase() !== WORD}
              onPress={() => void confirm()}
            />
          </>
        }
      >
        {chosen ? (
          <View style={{ gap: theme.space[3] }}>
            <Text>{`This deletes ${chosen.summary()}.`}</Text>
            <Text variant="caption" color="textSecondary">
              {cloud
                ? 'It cannot be undone here. Download a file with Export everything first: Restore from backup can add your records back later (receipt photos and portfolio images are not in the file).'
                : 'Preview: only the sample data on this screen is cleared.'}
            </Text>
            <TextField
              label={`Type ${WORD} to confirm`}
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
            />
          </View>
        ) : null}
      </Sheet>
    </Card>
  );
}
