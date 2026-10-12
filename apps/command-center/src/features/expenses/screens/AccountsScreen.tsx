import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Plus } from '@/components/icons';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { Sheet } from '@/components/overlays';
import { Button, Card } from '@/components/ui';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AccountDetail } from '../accounts/AccountDetail';
import { AccountGroupsCard } from '../accounts/AccountGroupsCard';
import { AccountSheet } from '../accounts/AccountSheet';
import { AccountSummaryCard } from '../accounts/AccountSummaryCard';
import { useAccountsView } from '../accounts/useAccountsView';
import { useExpenseStore } from '../state/expenseStore';
import { useExpenseUi } from '../state/expenseUi';

type Editing = { id: string | null } | null;

/** Accounts (Money Manager's Accounts tab): assets, liabilities and each account's balance. */
export function AccountsScreen() {
  const router = useRouter();
  const fit = useFitMode(true);
  const { isDesktop } = useBreakpoint();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const view = useAccountsView(selectedId);
  const accounts = useExpenseStore((state) => state.accounts);
  const detail = view.detail;
  const openTransactions = (id: string) => {
    useExpenseUi.getState().setAccount(id);
    setDetailOpen(false);
    router.push('/dashboard/expenses' as Href);
  };
  const content = detail ? (
    <AccountDetail
      detail={detail}
      onEdit={() => setEditing({ id: detail.account.id })}
      onOpenTransactions={() => openTransactions(detail.account.id)}
    />
  ) : null;
  const grow = fit ? { flex: 1 } : undefined;
  return (
    <Screen fit>
      <PageHeader
        size="compact"
        title="Accounts"
        meta={<SampleDataBadge editable />}
        actions={
          <Button label="Add account" icon={Plus} onPress={() => setEditing({ id: null })} />
        }
      />
      <AccountSummaryCard summary={view.summary} />
      <BentoRow stackBelow="desktop" fill={1}>
        <BentoCell flex={5}>
          <AccountGroupsCard
            groups={view.groups}
            selectedId={isDesktop ? (detail?.account.id ?? null) : null}
            onSelect={(id) => {
              setSelectedId(id);
              if (!isDesktop) setDetailOpen(true);
            }}
            onAdd={() => setEditing({ id: null })}
            style={grow}
          />
        </BentoCell>
        {isDesktop ? (
          <BentoCell flex={7}>
            <Card index={2} style={grow}>
              {content}
            </Card>
          </BentoCell>
        ) : null}
      </BentoRow>
      {isDesktop ? null : (
        <Sheet
          visible={detailOpen && !!detail}
          onClose={() => setDetailOpen(false)}
          title={detail?.account.name ?? 'Account'}
        >
          {content}
        </Sheet>
      )}
      {editing ? (
        <AccountSheet
          key={editing.id ?? 'new'}
          account={accounts.find((item) => item.id === editing.id) ?? null}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setSelectedId(id);
          }}
        />
      ) : null}
    </Screen>
  );
}
