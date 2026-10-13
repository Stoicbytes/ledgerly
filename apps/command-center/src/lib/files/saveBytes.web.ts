/** Downloads the bytes as a file; nothing leaves the browser. */
export async function saveBytes(bytes: Uint8Array, fileName: string, type: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const canSaveBytes = true;
