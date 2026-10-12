import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSession } from '@/features/auth/sessionStore';
import { signedReceiptUrl, uploadReceiptFile } from '@/lib/data/storageRepository';
import { renderWithProviders } from '@/test/render';
import { useTransactionForm } from '../../state/transactionForm';
import { PhotoField } from '../PhotoField';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const asset = (patch: object) => ({
  canceled: false,
  assets: [
    {
      uri: 'file:///receipt.jpg',
      width: 300,
      height: 400,
      mimeType: 'image/jpeg',
      fileSize: 2_000,
      ...patch,
    },
  ],
});

jest.mock('@/lib/data/storageRepository', () => ({
  mediaFolder: jest.fn(async () => 'user-1'),
  signedReceiptUrl: jest.fn(),
  uploadReceiptFile: jest.fn(),
}));

beforeEach(() => {
  useSession.setState({ status: 'preview' });
  useTransactionForm.getState().openNew();
  global.fetch = jest.fn(async () => ({ blob: async () => new Blob(['x']) })) as never;
});

describe('PhotoField', () => {
  it('attaches an uploaded photo and removes it', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(asset({}) as never);
    await renderWithProviders(<PhotoField />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Upload' }));
    });
    expect(useTransactionForm.getState().draft.photo).toMatchObject({
      uri: 'file:///receipt.jpg',
      mimeType: 'image/jpeg',
      bytes: 2_000,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Remove the photo' }));
    expect(useTransactionForm.getState().draft.photo).toBeNull();
  });

  it('refuses files that are not photos', async () => {
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue(asset({ mimeType: 'application/pdf' }) as never);
    await renderWithProviders(<PhotoField />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Upload' }));
    });
    expect(screen.getByText('Choose a photo (JPEG, PNG, WebP or HEIC).')).toBeTruthy();
    expect(useTransactionForm.getState().draft.photo).toBeNull();
  });

  it('asks for camera permission and explains a refusal', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValue({ granted: false } as never);
    await renderWithProviders(<PhotoField />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    });
    expect(screen.getByText('Allow camera access to take a receipt photo.')).toBeTruthy();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('signed in, uploads the photo privately and makes Save wait for it', async () => {
    useSession.setState({ status: 'signedIn' });
    let finish = () => {};
    jest
      .mocked(uploadReceiptFile)
      .mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(asset({}) as never);
    await renderWithProviders(<PhotoField />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Upload' }));
    });
    expect(useTransactionForm.getState().uploading).toBe(true);
    expect(useTransactionForm.getState().submit('save')).toEqual({ ok: false });
    await act(async () => finish());
    expect(useTransactionForm.getState().uploading).toBe(false);
    expect(useTransactionForm.getState().draft.photo?.path).toMatch(/^user-1\/[0-9a-f-]{36}\.jpg$/);
    expect(screen.getByText('Saved privately')).toBeTruthy();
  });

  it('explains a failed upload and attaches nothing', async () => {
    useSession.setState({ status: 'signedIn' });
    jest.mocked(uploadReceiptFile).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(asset({}) as never);
    await renderWithProviders(<PhotoField />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Upload' }));
    });
    expect(
      screen.getByText('Could not upload the photo. Check the connection and try again.'),
    ).toBeTruthy();
    expect(useTransactionForm.getState().draft.photo).toBeNull();
    expect(useTransactionForm.getState().uploading).toBe(false);
  });

  it('shows a stored photo through a short-lived link', async () => {
    jest.mocked(signedReceiptUrl).mockResolvedValue('https://example.test/signed');
    useTransactionForm.getState().update({
      photo: {
        uri: '',
        path: 'user-1/r.jpg',
        width: 3,
        height: 4,
        mimeType: 'image/jpeg',
        bytes: 1,
      },
    });
    await renderWithProviders(<PhotoField />);
    await act(async () => {});
    expect(signedReceiptUrl).toHaveBeenCalledWith('user-1/r.jpg');
    expect(screen.getByText('Saved privately')).toBeTruthy();
  });

  it('does not attach a photo that finishes uploading after the form was reopened', async () => {
    useSession.setState({ status: 'signedIn' });
    let finish = () => {};
    jest
      .mocked(uploadReceiptFile)
      .mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(asset({}) as never);
    await renderWithProviders(<PhotoField />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Upload' }));
    });
    await act(async () => {
      useTransactionForm.getState().close();
      useTransactionForm.getState().openNew();
    });
    await act(async () => finish());
    expect(useTransactionForm.getState().draft.photo).toBeNull();
  });
});
