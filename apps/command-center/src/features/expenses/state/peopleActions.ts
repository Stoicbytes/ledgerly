import {
  personInUse,
  todayIso,
  validateName,
  type Person,
  type Transaction,
} from '@/lib/domain/expenses';
import { newId } from '@/lib/ids';
import { useExpenseStore } from './expenseStore';

/**
 * People actions for the preview store (kept beside it so the store stays small).
 * Each maps to a future repository call, like the store's own actions.
 */
export function savePerson(name: string, id?: string | null): Person | string {
  const { people } = useExpenseStore.getState();
  const problem = validateName(name, people, id ?? undefined);
  if (problem) return problem;
  const existing = id ? people.find((item) => item.id === id) : undefined;
  const person: Person = {
    id: existing?.id ?? newId(),
    name: name.trim(),
    order: existing?.order ?? people.reduce((max, item) => Math.max(max, item.order + 1), 0),
  };
  useExpenseStore.setState({
    people: existing
      ? people.map((item) => (item.id === person.id ? person : item))
      : [...people, person],
  });
  return person;
}

/** Only people without shares or repayments can be deleted; returns false otherwise. */
export function deletePerson(id: string): boolean {
  const { people, transactions } = useExpenseStore.getState();
  if (personInUse(id, transactions)) return false;
  useExpenseStore.setState({ people: people.filter((item) => item.id !== id) });
  return true;
}

export type RepaymentInput = {
  personId: string;
  amount: number;
  accountId: string;
  date?: string;
  /** The expenses this payment was for; omit for a general repayment. */
  settles?: string[];
};

/**
 * Records money a person paid back into an account. It is stored as income linked to
 * the person, so it raises that account's balance without counting as income.
 */
export function recordRepayment({
  personId,
  amount,
  accountId,
  date,
  settles = [],
}: RepaymentInput): Transaction {
  const person = useExpenseStore.getState().people.find((item) => item.id === personId);
  return useExpenseStore.getState().saveTransaction({
    kind: 'income',
    date: date ?? todayIso(),
    amount,
    accountId,
    toAccountId: null,
    fee: 0,
    categoryId: null,
    note: person ? `Paid back by ${person.name}` : 'Paid back',
    splits: [],
    personId,
    settles,
  });
}
