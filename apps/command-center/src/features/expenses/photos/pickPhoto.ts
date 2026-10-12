import * as ImagePicker from 'expo-image-picker';
import { dataUrlBytes, photoError, type Photo } from '@/lib/domain/expenses';

export type PickResult = { photo: Photo } | { error: string } | null;

/**
 * Takes a photo with the camera or picks one from the library. Images only, compressed,
 * without EXIF (no location metadata requested). Returns null when the user cancels.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { error: 'Allow camera access to take a receipt photo.' };
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      exif: false,
      allowsMultipleSelection: false,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    const mimeType =
      asset.mimeType ??
      (asset.uri.startsWith('data:image/') ? asset.uri.slice(5, asset.uri.indexOf(';')) : null);
    const bytes = asset.fileSize ?? dataUrlBytes(asset.uri);
    const problem = photoError(mimeType, bytes);
    if (problem) return { error: problem };
    return {
      photo: {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType: mimeType ?? 'image/jpeg',
        bytes,
      },
    };
  } catch {
    return { error: 'Could not open the photo. Try again.' };
  }
}
