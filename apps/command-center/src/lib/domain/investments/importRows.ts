import type { TradebookTrade } from './tradebook';
import type { FundTxn, Trade } from './types';

/** Tradebook trades as app rows: amounts are quantity × price (the broker lists no stamp duty or charges). */
const scaled = (value: number) => BigInt(Math.round(value * 10000));

/** Paise for quantity × price, rounded half up on exact decimals (no floating-point drift). */
export const amountOf = (trade: Pick<TradebookTrade, 'quantity' | 'price'>) =>
  Number((scaled(trade.quantity) * scaled(trade.price) + BigInt(500000)) / BigInt(1000000));

export function asFundTxn(trade: TradebookTrade, fundId: string, id: string): FundTxn {
  return {
    id,
    fundId,
    kind: trade.kind,
    date: trade.date,
    amount: amountOf(trade),
    stampDuty: 0,
    units: trade.quantity,
    nav: trade.price,
    sipId: null,
    note: '',
    createdAt: 0,
  };
}

export function asTrade(trade: TradebookTrade, stockId: string, id: string): Trade {
  return {
    id,
    stockId,
    kind: trade.kind,
    date: trade.date,
    quantity: trade.quantity,
    price: Math.round(trade.price * 100),
    charges: 0,
    amount: null,
    ratioFrom: null,
    ratioTo: null,
    note: '',
    createdAt: 0,
  };
}
