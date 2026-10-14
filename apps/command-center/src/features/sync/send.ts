import type { LedgerChanges } from '@/lib/data/ledgerRepository';
import { RpcError } from '@/lib/data/rpc';
import { UNCHECKED, type Conflict, type ListKey, type SaveResult } from '@/lib/data/saveResult';
import { chunkChanges, halves, toOps } from './batches';

/** A row the database refused to save or delete, with the reason it gave. */
export type Refusal = { list: ListKey; id: string; deleting: boolean; error: RpcError };

export type SendOutcome = {
  conflicts: Conflict[];
  refused: Refusal[];
  /** Why sending stopped early (offline, server busy, signed out); the rest waits. */
  error: unknown;
};

type Options = {
  save: (part: LedgerChanges) => Promise<SaveResult | undefined>;
  /** Called for each part the database accepted; false stops (the session ended). */
  confirmed: (part: LedgerChanges, result: SaveResult) => boolean;
};

/** After this many refusals in one save, the rest of a refused part is not split further. */
const MAX_SPLITS = 64;
const STOPPED = new Error('stopped');

/**
 * Sends a save in parts. A part the database refuses is split in halves and sent again,
 * until only the refused rows are left out; everything else is saved.
 */
export async function sendChanges(changes: LedgerChanges, options: Options): Promise<SendOutcome> {
  const outcome: SendOutcome = { conflicts: [], refused: [], error: null };
  let splits = 0;
  const refuseAll = (part: LedgerChanges, error: RpcError) =>
    outcome.refused.push(
      ...toOps(part).map((op) => ({ list: op.list, id: op.id, deleting: !op.row, error })),
    );
  const send = async (part: LedgerChanges): Promise<void> => {
    let result: SaveResult;
    try {
      result = (await options.save(part)) ?? UNCHECKED;
    } catch (error) {
      if (!(error instanceof RpcError) || error.retryable) throw error;
      const split = splits < MAX_SPLITS ? halves(part) : null;
      splits += 1;
      if (!split) return void refuseAll(part, error);
      await send(split[0]);
      await send(split[1]);
      return;
    }
    outcome.conflicts.push(...result.conflicts);
    if (!options.confirmed(part, result)) throw STOPPED;
  };
  try {
    for (const part of chunkChanges(changes)) await send(part);
  } catch (error) {
    outcome.error = error;
  }
  return outcome;
}

export const wasStopped = (error: unknown) => error === STOPPED;
