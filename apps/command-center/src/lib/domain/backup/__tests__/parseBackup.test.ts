import { buildExport } from '@/features/settings/exportAll';
import { sampleData, sampleSite, u } from '../__fixtures__/sample';
import { BackupError, MAX_BACKUP_BYTES, parseBackup, sitePayloads } from '..';

type Json = Record<string, unknown> & { data: Record<string, unknown[]> };

const exported = (): Json => JSON.parse(JSON.stringify(buildExport(sampleData(), sampleSite())));
const bytes = (text: string) => new TextEncoder().encode(text);
const read = (file: unknown) =>
  parseBackup(bytes(typeof file === 'string' ? file : JSON.stringify(file)));
const refused = (file: unknown, reason: RegExp) => {
  expect(() => read(file)).toThrow(BackupError);
  expect(() => read(file)).toThrow(reason);
};

describe('reading a backup file', () => {
  it('reads a file from Export everything', () => {
    const backup = read(exported());
    expect(backup.data.transactions).toHaveLength(4);
    expect(backup.data.transactions[0]).not.toHaveProperty('receipt');
    expect(backup.site?.rows.skill).toHaveLength(1);
  });

  it('refuses files that are not backups, or from a newer version', () => {
    refused('not json', /not readable JSON/);
    refused({ format: 'other', version: 1 }, /not a Ledgerly/);
    refused({ ...exported(), version: undefined }, /no valid format version/);
    refused({ ...exported(), version: 2 }, /newer version/);
    expect(() => parseBackup(new Uint8Array([0xff, 0xfe, 0x00]))).toThrow(/not readable/);
  });

  it('refuses files over 20 MB before reading them', () => {
    const big = new Uint8Array(MAX_BACKUP_BYTES + 1);
    expect(() => parseBackup(big)).toThrow(/larger than 20 MB/);
  });

  it('refuses keys that could reach an object prototype, anywhere in the file', () => {
    const text = JSON.stringify(exported());
    refused(text.replace('"name":"Cash"', '"name":"Cash","__proto__":{"admin":true}'), /__proto__/);
    refused(
      text.replace('"app":', '"constructor":{"prototype":{}},"app":'),
      /constructor|prototype/,
    );
    refused(text.replace('"full_name":', '"__proto__":{"x":1},"full_name":'), /__proto__/);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it('refuses wrong types, values over the database limits and unknown fields', () => {
    const cases: [(file: Json) => void, RegExp][] = [
      [(f) => ((f.data.transactions[0] as Json).amount = '300'), /amount is not a whole number/],
      [(f) => ((f.data.transactions[0] as Json).amount = 1.5), /amount/],
      [(f) => ((f.data.transactions[0] as Json).amount = 0), /amount/],
      [(f) => ((f.data.transactions[0] as Json).note = 'x'.repeat(501)), /longer than 500/],
      [(f) => ((f.data.notes[0] as Json).body = 'x'.repeat(5_000_000)), /longer than 20000/],
      [(f) => ((f.data.transactions[0] as Json).date = '2026-02-30'), /not a real date/],
      [(f) => ((f.data.accounts[0] as Json).id = 'abc'), /not an id/],
      [(f) => ((f.data.accounts[0] as Json).group = 'crypto'), /not one of the known values/],
      [(f) => ((f.data.accounts[0] as Json).extra = 1), /extra is unknown/],
      [(f) => (f.data.accounts = {} as unknown as unknown[]), /not a list/],
      [(f) => ((f.data.categories[0] as Json).icon = '<script>'), /format/],
      [(f) => ((f.data.funds[0] as Json).manualNav = -1), /not a number/],
      [(f) => ((f.data.stocks[0] as Json).symbol = 'abc'), /format/],
    ];
    for (const [change, reason] of cases) {
      const file = exported();
      change(file);
      refused(file, reason);
    }
  });

  it('refuses broken references and repeated ids', () => {
    const dangling = exported();
    (dangling.data.transactions[0] as Json).accountId = u(999);
    refused(dangling, /refers to an account not in the file/);
    const twice = exported();
    twice.data.accounts.push({ ...(twice.data.accounts[0] as Json), name: 'Other' });
    refused(twice, /appears twice/);
    const split = exported();
    (split.data.transactions[0] as Json).splits = [{ personId: u(20), amount: 999999 }];
    refused(split, /splits too much/);
    const transfer = exported();
    (transfer.data.transactions[2] as Json).toAccountId = null;
    refused(transfer, /transfer rules/);
  });

  it('checks the portfolio site for shape and leaves images out', () => {
    const big = exported();
    (big.data as unknown as Json).portfolioSite = { rows: { skill: 'x' } };
    refused(big, /not a list of items/);
    const unknown = exported();
    (unknown.data as unknown as Json).portfolioSite = { rows: { hack: [] } };
    refused(unknown, /is unknown/);
    const { items, invalid } = sitePayloads(sampleSite());
    expect(invalid).toBe(0);
    expect(items.map((item) => item.kind)).toEqual(['profile', 'skill_group', 'skill']);
    expect(items[0].payload.avatar).toBeNull();
    expect(items[2].payload).toMatchObject({ id: u(102), group_id: u(101), name: 'SQL' });
  });
});
