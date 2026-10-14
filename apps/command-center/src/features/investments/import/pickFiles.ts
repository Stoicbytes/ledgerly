/** A file the owner chose, read into memory (it is never uploaded). */
export type PickedFile = { name: string; bytes: Uint8Array };

/**
 * Phones: choosing files arrives with the phone apps (Expo document picker); until then the
 * import is offered in the web app only and the sheet says so.
 */
export const canPickFiles = false;

/** What the chooser offers: file types, the largest file kept, and one or several files. */
export type PickOptions = { accept?: string; maxBytes?: number; multiple?: boolean };

export async function pickFiles(_options?: PickOptions): Promise<PickedFile[] | null> {
  return null;
}
