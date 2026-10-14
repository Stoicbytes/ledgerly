import { BRAND } from '@/branding';
import type { CloudData } from '@/lib/data/ledgerRepository';
import { BACKUP_FORMAT, BACKUP_VERSION } from '@/lib/domain/backup/types';

/**
 * One file with everything you keep in the app, to keep as a backup or take elsewhere:
 * accounts, categories, people, entries, recurring entries, notes (Recently deleted too),
 * funds, SIPs, shares, goals, employers, payslips, the PF passbook and the portfolio
 * site's content. Receipt photos stay in storage; entries keep a reference to them.
 * Settings → Restore from backup reads it back (lib/domain/backup).
 */
export function buildExport(data: CloudData, site: unknown, now = new Date()) {
  const { portfolio, noteExtras: _noteExtras, ...rest } = data;
  return {
    app: BRAND.name,
    // Restore from backup reads this format; bump the version when the shape changes.
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    about: {
      money: 'Amounts are in paise (₹1 = 100 paise); NAVs and fund units are as entered.',
      dates: 'Dates are YYYY-MM-DD; times are ISO 8601 in UTC.',
      receipts: 'Receipt photos are not in this file; each entry keeps its storage path.',
    },
    data: {
      ...rest,
      transactions: data.transactions.map(({ photo, ...entry }) => ({
        ...entry,
        receipt: photo?.path ?? null,
      })),
      funds: portfolio.funds,
      fundTransactions: portfolio.fundTxns,
      sips: portfolio.sips,
      stocks: portfolio.stocks,
      stockTrades: portfolio.trades,
      portfolioSite: site ?? null,
    },
  };
}

export const exportFileName = (now = new Date()) =>
  `${BRAND.name.toLowerCase()}-export-${now.toISOString().slice(0, 10)}.json`;
