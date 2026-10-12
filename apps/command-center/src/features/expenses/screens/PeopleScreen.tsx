import { useMemo, useState } from 'react';
import { useToast } from '@/components/feedback';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { Sheet } from '@/components/overlays';
import { Card } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { personBalances, type OpenSplit } from '@/lib/domain/expenses';
import { ExpensesHeader } from '../components/ExpensesHeader';
import { PeopleListCard } from '../people/PeopleListCard';
import { PersonDetail } from '../people/PersonDetail';
import { PersonNameSheet } from '../people/PersonNameSheet';
import { SettleSheet } from '../people/SettleSheet';
import { useExpenseStore } from '../state/expenseStore';
import { deletePerson } from '../state/peopleActions';

/**
 * Expenses › People: who owes you what from split expenses, and marking repayments.
 * List beside the selected person on desktop; on phones the person opens as a sheet.
 */
export function PeopleScreen() {
  const fit = useFitMode(true);
  const { isDesktop } = useBreakpoint();
  const toast = useToast();
  const people = useExpenseStore((state) => state.people);
  const transactions = useExpenseStore((state) => state.transactions);
  const balances = useMemo(
    () =>
      personBalances(
        [...people].sort((a, b) => a.order - b.order),
        transactions,
      ).sort((a, b) => b.outstanding - a.outstanding),
    [people, transactions],
  );
  const [selection, setSelection] = useState<string | null>(null);
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null);
  // null = closed; { target: null } = a general payment; otherwise one shared expense.
  const [settling, setSettling] = useState<{
    target: { split: OpenSplit; title: string } | null;
  } | null>(null);
  const chosen =
    balances.find((item) => item.person.id === selection) ?? (isDesktop ? balances[0] : undefined);
  const remove = () => {
    if (!chosen) return;
    const previous = people;
    if (!deletePerson(chosen.person.id)) {
      toast.show({
        message: `${chosen.person.name} has shared expenses or repayments, so they stay.`,
      });
      return;
    }
    setSelection(null);
    toast.show({
      message: `${chosen.person.name} removed`,
      action: { label: 'Undo', onPress: () => useExpenseStore.setState({ people: previous }) },
    });
  };
  const detail = chosen ? (
    <PersonDetail
      balance={chosen}
      onSettle={() => {
        // Keep this person selected when the list re-sorts after the payment.
        setSelection(chosen.person.id);
        setSettling({ target: null });
      }}
      onSettleOne={(split, title) => {
        setSelection(chosen.person.id);
        setSettling({ target: { split, title } });
      }}
      onRename={() => {
        setSelection(chosen.person.id);
        setNaming('rename');
      }}
      onDelete={remove}
    />
  ) : null;
  const grow = fit ? { flex: 1 } : undefined;
  return (
    <Screen fit>
      <ExpensesHeader period="none" />
      <BentoRow stackBelow="desktop" fill={1}>
        <BentoCell flex={5}>
          <PeopleListCard
            balances={balances}
            selectedId={chosen?.person.id ?? null}
            onSelect={setSelection}
            onAdd={() => setNaming('new')}
            style={grow}
          />
        </BentoCell>
        {isDesktop && detail ? (
          <BentoCell flex={7}>
            <Card index={2} style={grow}>
              <PanelScroll>{detail}</PanelScroll>
            </Card>
          </BentoCell>
        ) : null}
      </BentoRow>
      {isDesktop ? null : (
        <Sheet
          visible={!!chosen && !naming && !settling}
          onClose={() => setSelection(null)}
          title={chosen?.person.name ?? ''}
        >
          {detail}
        </Sheet>
      )}
      {naming ? (
        <PersonNameSheet
          key={naming === 'new' ? 'new' : chosen?.person.id}
          person={naming === 'rename' ? (chosen?.person ?? null) : null}
          visible
          onClose={() => setNaming(null)}
          onSaved={(person) => {
            setNaming(null);
            setSelection(person.id);
          }}
        />
      ) : null}
      {settling && chosen ? (
        <SettleSheet
          key={`${chosen.person.id}-${settling.target?.split.transaction.id ?? 'all'}`}
          balance={chosen}
          target={settling.target}
          visible
          onClose={() => setSettling(null)}
        />
      ) : null}
    </Screen>
  );
}
