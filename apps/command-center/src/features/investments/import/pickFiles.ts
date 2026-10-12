/** A file the owner chose, read into memory (it is never uploaded). */
export type PickedFile = { name: string; bytes: Uint8Array };

/**
 * Phones: choosing files arrives with the phone apps (Expo document picker); until then the
 * import is offered in the web app only and the sheet says so.
 */
export const canPickFiles = false;

export async function pickFiles(): Promise<PickedFile[] | null> {
  return null;
}
