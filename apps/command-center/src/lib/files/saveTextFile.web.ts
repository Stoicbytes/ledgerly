/** Downloads the text as a file (CSV by default); nothing leaves the browser. */
export async function saveTextFile(
  text: string,
  fileName: string,
  type = 'text/csv;charset=utf-8',
): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
