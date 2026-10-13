import { flushCloudSync, hasUnsavedChanges, reloadCloudData } from '@/features/sync/cloudSync';
import { resetData, ResetUnavailableError } from '@/lib/data/resetRepository';
import type { ResetOption } from './resetScopes';

/**
 * Runs a reset. Signed in: unsaved edits are sent first (a reset never races a save),
 * the database deletes the rows in one transaction, and everything is loaded again.
 * Preview: the sample data in memory is cleared. Returns the message to show.
 */
export async function runReset(option: ResetOption, cloud: boolean): Promise<string> {
  if (!cloud) {
    option.clearLocally();
    return `${option.title} cleared (preview: sample data only).`;
  }
  await flushCloudSync();
  if (hasUnsavedChanges()) {
    throw new Error(
      'Some changes are still waiting to be saved. Check your connection and try again.',
    );
  }
  const counts = await resetData(option.scope);
  await reloadCloudData();
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return `${option.title} reset: ${total.toLocaleString('en-IN')} ${total === 1 ? 'item' : 'items'} deleted.`;
}

export function resetErrorMessage(error: unknown): string {
  if (error instanceof ResetUnavailableError) {
    return 'Run database migration 0018 (reset_data) in Supabase first; see SUPABASE_SETUP.md.';
  }
  if (error instanceof Error && error.message.startsWith('Some changes')) return error.message;
  return 'The reset did not go through. Nothing was deleted; try again.';
}
