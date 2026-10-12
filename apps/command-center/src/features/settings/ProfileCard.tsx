import { useState } from 'react';
import { View } from 'react-native';
import { UserRound } from '@/components/icons';
import { Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { useSession } from '@/features/auth/sessionStore';
import { TextField } from '@/features/expenses/components/TextField';
import { requestEmailChange, updateDisplayName } from '@/lib/data/authRepository';
import { useTheme } from '@/theme';

type Notice = { tone: 'success' | 'danger'; text: string } | null;

/**
 * The name the app greets you by, and the email you sign in with. Changing the email
 * keeps the same account (data, two-step sign-in); Supabase confirms it by email first.
 */
export function ProfileCard({ index }: { index: number }) {
  const theme = useTheme();
  const { email, name } = useSession();
  const [nameText, setNameText] = useState(name ?? '');
  const [emailText, setEmailText] = useState('');
  const [busy, setBusy] = useState<'name' | 'email' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const saveName = async () => {
    setBusy('name');
    const result = await updateDisplayName(nameText);
    setBusy(null);
    setNotice(
      result.ok
        ? { tone: 'success', text: 'Name saved.' }
        : { tone: 'danger', text: result.message },
    );
  };
  const changeEmail = async () => {
    setBusy('email');
    const result = await requestEmailChange(emailText);
    setBusy(null);
    setNotice(
      result.ok
        ? {
            tone: 'success',
            text: `Check ${emailText.trim()} (and your current inbox) for the confirmation link. Until you confirm, you keep signing in with ${email ?? 'your current email'}.`,
          }
        : { tone: 'danger', text: result.message },
    );
    if (result.ok) setEmailText('');
  };
  return (
    <Card index={index} style={{ gap: theme.space[3] }}>
      <CardHeader
        title="Profile"
        subtitle="Your name in the app, and your sign-in email"
        action={<CategoryIcon icon={UserRound} tint={1} size={40} />}
      />
      <View style={{ gap: theme.space[2] }}>
        <TextField
          label="Display name"
          value={nameText}
          onChangeText={setNameText}
          placeholder="How the app greets you"
          maxLength={60}
        />
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label="Save name"
            variant="secondary"
            loading={busy === 'name'}
            disabled={!nameText.trim() || nameText.trim() === (name ?? '')}
            onPress={() => void saveName()}
          />
        </View>
      </View>
      <View style={{ gap: theme.space[2] }}>
        <TextField
          label="New sign-in email"
          value={emailText}
          onChangeText={setEmailText}
          placeholder={email ?? 'name@example.com'}
          autoCapitalize="none"
          keyboardType="email-address"
          hint="Your data and two-step sign-in stay with the account."
        />
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label="Change email"
            variant="secondary"
            loading={busy === 'email'}
            disabled={!/^\S+@\S+\.\S+$/.test(emailText.trim())}
            onPress={() => void changeEmail()}
          />
        </View>
      </View>
      {notice ? (
        <Text variant="caption" color={notice.tone} role="status">
          {notice.text}
        </Text>
      ) : null}
    </Card>
  );
}
