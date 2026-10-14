import type { ListKey } from '@/lib/data/saveResult';
import type { RpcError } from '@/lib/data/rpc';
import type { Refusal } from './send';

const NAMES: Record<ListKey, string> = {
  accounts: 'account',
  categories: 'category',
  people: 'person',
  transactions: 'entry',
  notes: 'note',
  mf_funds: 'fund',
  mf_sips: 'SIP',
  mf_transactions: 'fund transaction',
  stocks: 'share',
  stock_trades: 'share trade',
  recurring: 'recurring entry',
  goals: 'goal',
  employers: 'employer',
  payslips: 'payslip',
  pf_entries: 'PF entry',
};

/** The database's reason in plain words (Postgres error codes). */
export function refusalReason(error: RpcError): string {
  if (error.status === 413) return 'too large to save';
  switch (error.code) {
    case '23514':
      return 'a value is outside what is allowed';
    case '23503':
      return 'it uses something that no longer exists';
    case '23505':
      return 'it duplicates another item';
    case '22001':
      return 'a text is too long';
    case '42501':
      return 'not allowed';
    default:
      return error.code?.startsWith('22') ? 'a value is not valid' : 'the server refused it';
  }
}

/** "1 change could not be saved: account “Bank” — a value is outside what is allowed". */
export function describeRefused(
  refused: Refusal[],
  labelOf: (list: ListKey, id: string) => string | null,
): string {
  const [first] = refused;
  const label = labelOf(first.list, first.id);
  const what = `${first.deleting ? 'deleting ' : ''}${NAMES[first.list]}${label ? ` “${label}”` : ''}`;
  const count = refused.length;
  const more = count > 1 ? ` (and ${count - 1} more)` : '';
  return `${count} ${count === 1 ? 'change' : 'changes'} could not be saved: ${what} — ${refusalReason(first.error)}${more}. The saved version is shown.`;
}

export const CONFLICT_NOTICE = 'Changed on another device — showing the newer version';

export const replayNotice = (count: number) =>
  `${count} unsaved ${count === 1 ? 'change' : 'changes'} from your last visit ${count === 1 ? 'was' : 'were'} saved`;

export const replaySkippedNotice = (count: number) =>
  `${count} unsaved ${count === 1 ? 'change' : 'changes'} from your last visit ${count === 1 ? 'was' : 'were'} not applied: changed on another device since`;
