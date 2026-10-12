import { useState } from 'react';
import { View } from 'react-native';
import { Download } from '@/components/icons';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import type { HoldingPlan } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { ImportHoldingCard } from './ImportHoldingCard';
import { canPickFiles } from './pickFiles';
import { useTradebookImport } from './useTradebookImport';

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space[2], marginTop: theme.space[4] }}>
      <Text variant="eyebrow" color="textTertiary" role="heading">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const Line = ({ plan, text }: { plan: HoldingPlan; text: string }) => (
  <Text variant="caption" color="textSecondary">
    {plan.name} · {text}
  </Text>
);

/** Choose broker tradebooks, review every trade they would add, then approve. */
export function ImportTradebookSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const toast = useToast();
  const flow = useTradebookImport();
  const toAdd = flow.plans.filter((plan) => plan.add.length);
  const upToDate = flow.plans.filter((plan) => !plan.add.length && plan.already);
  const blocked = flow.plans.filter((plan) => !plan.add.length && !plan.already);
  const review = flow.phase === 'review';
  const approve = () => {
    const result = flow.approve();
    toast.show({
      message: `Added ${plural(result.trades, 'trade')} to ${plural(result.holdings, 'holding')}.`,
    });
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Import tradebook"
      description={
        review
          ? `From ${flow.files.join(', ')}. Nothing is added until you approve.`
          : 'Add trades from your broker. You review every one before anything is saved.'
      }
      width={620}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <View style={{ flex: 1 }} />
          {review ? (
            <>
              <Button label="Other files" variant="secondary" onPress={flow.reset} />
              <Button
                label={
                  flow.tradeCount
                    ? `Approve and add ${plural(flow.tradeCount, 'trade')}`
                    : 'Nothing to add'
                }
                disabled={!flow.tradeCount || flow.uncovered.length > 0}
                onPress={approve}
              />
            </>
          ) : (
            <Button
              label={flow.phase === 'reading' ? 'Reading…' : 'Choose files'}
              icon={Download}
              disabled={!canPickFiles || flow.phase === 'reading'}
              onPress={() => void flow.choose()}
            />
          )}
        </>
      }
    >
      {!review ? (
        <View style={{ gap: theme.space[2] }}>
          <Text color="textSecondary">
            In Zerodha Console open Reports → Tradebook, pick Equity or Mutual funds and the dates,
            and download XLSX (or CSV). You can choose several files at once; a trade in two files
            counts once.
          </Text>
          <Text variant="caption" color="textTertiary">
            The files are read on this device and not kept. Trades already in the app are skipped.
          </Text>
          {!canPickFiles ? (
            <Text variant="caption" color="warning">
              Choosing files works in the web app for now; it comes to the phone app with its next
              build.
            </Text>
          ) : null}
        </View>
      ) : (
        <View>
          <Text color="textSecondary">
            {toAdd.length
              ? `${plural(flow.tradeCount, 'new trade')} in ${plural(toAdd.length, 'holding')} to review.`
              : 'Everything in these files is already in the app.'}
          </Text>
          {flow.problems.map((problem) => (
            <Text key={problem} variant="caption" color="warning">
              {problem}
            </Text>
          ))}
          {toAdd.length ? (
            <Section title="To add">
              {toAdd.map((plan) => (
                <ImportHoldingCard
                  key={plan.key}
                  plan={plan}
                  selected={flow.selected}
                  check={flow.checks.get(plan.key)}
                  onToggle={flow.toggle}
                />
              ))}
              <Text variant="caption" color="textTertiary">
                Amounts are quantity × price, as in the tradebook: stamp duty and charges are not in
                it.
              </Text>
            </Section>
          ) : null}
          {upToDate.length ? (
            <Section title="Already up to date">
              {upToDate.map((plan) => (
                <Line
                  key={plan.key}
                  plan={plan}
                  text={`${plural(plan.already, 'trade')} already in the app`}
                />
              ))}
            </Section>
          ) : null}
          {blocked.length ? (
            <Section title="Cannot be added">
              {blocked.map((plan) => (
                <Line
                  key={plan.key}
                  plan={plan}
                  text={`${plural(plan.leftOut.length, 'trade')} selling units bought before this file starts`}
                />
              ))}
            </Section>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

export function ImportTradebookButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Import" variant="secondary" icon={Download} onPress={() => setOpen(true)} />
      {open ? <ImportTradebookSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
