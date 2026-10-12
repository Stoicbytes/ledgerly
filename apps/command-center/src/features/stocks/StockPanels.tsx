import { StockDetailSheet } from './StockDetailSheet';
import { StockEditSheet } from './StockEditSheet';
import { TradeSheet } from './TradeSheet';

/** Which stock sheet is open (one at a time; closing a form returns to the stock). */
export type StockPanel =
  | { type: 'detail'; stockId: string }
  | { type: 'trade'; stockId: string; tradeId: string | null }
  | { type: 'stock'; stockId: string | null }
  | null;

export function StockPanels({
  panel,
  onChange,
}: {
  panel: StockPanel;
  onChange: (panel: StockPanel) => void;
}) {
  if (!panel) return null;
  const back = (stockId: string | null) => onChange(stockId ? { type: 'detail', stockId } : null);
  switch (panel.type) {
    case 'detail':
      return (
        <StockDetailSheet
          stockId={panel.stockId}
          onClose={() => onChange(null)}
          onAddTrade={() => onChange({ type: 'trade', stockId: panel.stockId, tradeId: null })}
          onEditTrade={(tradeId) => onChange({ type: 'trade', stockId: panel.stockId, tradeId })}
          onEditStock={() => onChange({ type: 'stock', stockId: panel.stockId })}
        />
      );
    case 'trade':
      return (
        <TradeSheet
          stockId={panel.stockId}
          tradeId={panel.tradeId}
          onClose={() => back(panel.stockId)}
        />
      );
    case 'stock':
      return (
        <StockEditSheet
          stockId={panel.stockId}
          onClose={() => back(panel.stockId)}
          onSaved={(stockId) => back(stockId)}
        />
      );
  }
}
