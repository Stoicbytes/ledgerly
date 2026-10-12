import type { FundTxnDraft } from '@/lib/domain/investments';
import { FundDetailSheet } from './FundDetailSheet';
import { FundEditSheet } from './FundEditSheet';
import { FundTxnSheet } from './FundTxnSheet';
import { SipSheet } from './SipSheet';

/** Which mutual fund sheet is open (one at a time; closing a form returns to the fund). */
export type FundPanel =
  | { type: 'detail'; fundId: string }
  | { type: 'txn'; fundId: string; txnId: string | null; preset?: Partial<FundTxnDraft> }
  | { type: 'fund'; fundId: string | null }
  | { type: 'sip'; fundId: string; sipId: string | null }
  | null;

export function FundPanels({
  panel,
  onChange,
}: {
  panel: FundPanel;
  onChange: (panel: FundPanel) => void;
}) {
  if (!panel) return null;
  const back = (fundId: string | null) => onChange(fundId ? { type: 'detail', fundId } : null);
  switch (panel.type) {
    case 'detail':
      return (
        <FundDetailSheet
          fundId={panel.fundId}
          onClose={() => onChange(null)}
          onAddTxn={() => onChange({ type: 'txn', fundId: panel.fundId, txnId: null })}
          onEditTxn={(txnId) => onChange({ type: 'txn', fundId: panel.fundId, txnId })}
          onEditFund={() => onChange({ type: 'fund', fundId: panel.fundId })}
          onSip={(sipId) => onChange({ type: 'sip', fundId: panel.fundId, sipId })}
        />
      );
    case 'txn':
      return (
        <FundTxnSheet
          fundId={panel.fundId}
          txnId={panel.txnId}
          preset={panel.preset}
          onClose={() => back(panel.fundId)}
        />
      );
    case 'fund':
      return (
        <FundEditSheet
          fundId={panel.fundId}
          onClose={() => back(panel.fundId)}
          onSaved={(fundId) => back(fundId)}
        />
      );
    case 'sip':
      return (
        <SipSheet fundId={panel.fundId} sipId={panel.sipId} onClose={() => back(panel.fundId)} />
      );
  }
}
