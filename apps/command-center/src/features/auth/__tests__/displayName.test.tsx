import { renderHook } from '@testing-library/react-native';
import { displayNameOf } from '@/lib/data/authRepository';
import { useSession } from '../sessionStore';
import { nameFromEmail, useDisplayName } from '../useDisplayName';

describe('display name', () => {
  it('reads the name set in Settings from the Auth profile', () => {
    expect(displayNameOf({ user_metadata: { display_name: '  Arjun  ' } })).toBe('Arjun');
    expect(displayNameOf({ user_metadata: {} })).toBeNull();
    expect(displayNameOf({})).toBeNull();
  });

  it('makes a readable name from the email until one is set', () => {
    expect(nameFromEmail('stoic.bytes@example.com')).toBe('Stoic Bytes');
    expect(nameFromEmail('arjun@example.com')).toBe('Arjun');
  });

  it('greets the signed-in user, never a fixed name', async () => {
    useSession.getState().setSignedIn('arjun.k@example.com');
    expect((await renderHook(() => useDisplayName())).result.current).toBe('Arjun K');
    useSession.getState().setSignedIn('arjun.k@example.com', 'Arjun');
    expect((await renderHook(() => useDisplayName())).result.current).toBe('Arjun');
    useSession.getState().setPreview();
    expect((await renderHook(() => useDisplayName())).result.current).toBe('Preview');
  });
});
