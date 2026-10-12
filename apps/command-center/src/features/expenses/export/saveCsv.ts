import { Share } from 'react-native';

/**
 * Phones: hands the CSV to the share sheet (save to Files, mail, Drive). The web
 * version downloads a file instead.
 */
export async function saveCsv(csv: string, fileName: string): Promise<void> {
  await Share.share({ title: fileName, message: csv });
}
