import { create } from 'zustand';
import {
  rebalanceSplits,
  DRAFT_FIELD_ORDER,
  todayIso,
  validateDraft,
  type DraftErrors,
  type DraftField,
  type Transaction,
  type TransactionDraft,
  type TransactionKind,
} from '@/lib/domain/expenses';
import { editDraft } from './editDraft';
import { getLedger, useExpenseStore } from './expenseStore';

/** Field order for the auto-advancing entry flow (Money Manager style). */
const FLOW: Record<TransactionKind, DraftField[]> = {
  expense: ['date', 'amount', 'category', 'account', 'note'],
  income: ['date', 'amount', 'category', 'account', 'note'],
  transfer: ['date', 'amount', 'account', 'toAccount', 'fee', 'note'],
};

const isEmpty = (draft: TransactionDraft, field: DraftField) =>
  ({
    date: !draft.date,
    amount: !draft.amountText.trim(),
    category: !draft.categoryId,
    account: !draft.accountId,
    toAccount: !draft.toAccountId,
    fee: false,
    split: false,
    note: false,
  })[field];

/** The next field to visit after `current`: the first empty one, else the note. */
export function nextField(draft: TransactionDraft, current: DraftField): DraftField | null {
  const order = FLOW[draft.kind];
  const rest = order.slice(order.indexOf(current) + 1);
  return rest.find((field) => isEmpty(draft, field)) ?? (current === 'note' ? null : 'note');
}

export type SubmitResult =
  | { ok: true; transaction: Transaction; created: boolean; previous: Transaction | null }
  | { ok: false };

type FormState = {
  open: boolean;
  editingId: string | null;
  draft: TransactionDraft;
  active: DraftField | null;
  errors: DraftErrors;
  last: { kind: TransactionKind; accountId: string | null };
  /** A receipt photo is being uploaded: saving waits for it. */
  uploading: boolean;
  /** Counts openings, so a slow upload never lands in a form opened later. */
  opened: number;
  setUploading: (uploading: boolean) => void;
  openNew: (defaults?: Partial<TransactionDraft>) => void;
  openEdit: (transaction: Transaction) => void;
  close: () => void;
  setKind: (kind: TransactionKind) => void;
  update: (patch: Partial<TransactionDraft>) => void;
  setActive: (field: DraftField | null) => void;
  advance: (from: DraftField) => void;
  choose: (field: 'category' | 'account' | 'toAccount', id: string) => void;
  submit: (mode: 'save' | 'continue') => SubmitResult;
};

const emptyDraft = (
  kind: TransactionKind,
  accountId: string | null,
  date = todayIso(),
): TransactionDraft => ({
  kind,
  date,
  amountText: '',
  categoryId: null,
  accountId,
  toAccountId: null,
  feeText: '',
  note: '',
  splits: [],
  splitMode: 'equal',
  myShareText: '',
  personId: null,
  photo: null,
});

const fieldsOf = (patch: Partial<TransactionDraft>): DraftField[] =>
  Object.keys(patch).map(
    (key) =>
      ({
        amountText: 'amount',
        categoryId: 'category',
        accountId: 'account',
        toAccountId: 'toAccount',
        feeText: 'fee',
        splits: 'split',
      })[key] ?? key,
  ) as DraftField[];

export const useTransactionForm = create<FormState>((set, get) => ({
  open: false,
  editingId: null,
  draft: emptyDraft('expense', null),
  active: null,
  errors: {},
  last: { kind: 'expense', accountId: null },
  uploading: false,
  opened: 0,

  setUploading: (uploading) => set({ uploading }),

  openNew: (defaults) => {
    const { last, opened } = get();
    const kind = defaults?.kind ?? last.kind;
    set({
      open: true,
      opened: opened + 1,
      uploading: false,
      editingId: null,
      errors: {},
      active: 'amount',
      draft: { ...emptyDraft(kind, last.accountId), ...defaults },
    });
  },

  openEdit: (transaction) =>
    set((state) => ({
      open: true,
      opened: state.opened + 1,
      uploading: false,
      editingId: transaction.id,
      errors: {},
      active: null,
      draft: editDraft(transaction),
    })),

  close: () => set({ open: false, active: null, errors: {}, uploading: false }),

  setKind: (kind) =>
    set((state) => {
      if (kind === state.draft.kind) return state;
      // Categories are kind-specific; transfers have none.
      return {
        draft: {
          ...state.draft,
          kind,
          categoryId: null,
          toAccountId: null,
          feeText: '',
          splits: [],
          splitMode: 'equal',
          myShareText: '',
          personId: null,
        },
        errors: {},
      };
    }),

  update: (patch) =>
    set((state) => {
      const errors = { ...state.errors };
      for (const field of fieldsOf(patch)) delete errors[field];
      // Equal shares follow the amount and the people in the split.
      return { draft: rebalanceSplits({ ...state.draft, ...patch }), errors };
    }),

  setActive: (active) => set({ active }),

  advance: (from) => set((state) => ({ active: nextField(state.draft, from) })),

  choose: (field, id) => {
    const key =
      field === 'category' ? 'categoryId' : field === 'account' ? 'accountId' : 'toAccountId';
    get().update({ [key]: id } as Partial<TransactionDraft>);
    get().advance(field);
  },

  submit: (mode) => {
    const { draft, editingId, open, uploading } = get();
    // A second tap while the sheet closes must not add the same entry again, and a
    // photo still uploading would be left out.
    if (!open || uploading) return { ok: false };
    const ledger = getLedger();
    const { errors, value } = validateDraft(draft, ledger);
    if (!value) {
      set({ errors, active: DRAFT_FIELD_ORDER.find((field) => errors[field]) ?? null });
      return { ok: false };
    }
    const previous = editingId
      ? (ledger.transactions.find((item) => item.id === editingId) ?? null)
      : null;
    const transaction = useExpenseStore.getState().saveTransaction(value, editingId);
    const last = { kind: value.kind, accountId: value.accountId };
    if (mode === 'continue') {
      // Keep type, date and account for the next entry; clear the rest.
      set({
        last,
        editingId: null,
        errors: {},
        active: 'amount',
        draft: emptyDraft(value.kind, value.accountId, value.date),
      });
    } else {
      set({ last, open: false, active: null, errors: {} });
    }
    return { ok: true, transaction, created: !editingId, previous };
  },
}));
