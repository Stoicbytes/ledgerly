import { Share } from 'react-native';

/**
 * Phones: hands the text (a CSV or JSON export) to the share sheet (save to Files, mail,
 * Drive). The web version downloads a file instead.
 */
export async function saveTextFile(text: string, fileName: string, _type?: string): Promise<void> {
  await Share.share({ title: fileName, message: text });
}
