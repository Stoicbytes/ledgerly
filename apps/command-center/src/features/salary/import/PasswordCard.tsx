import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { useTheme } from '@/theme';
import { ImportBox } from './ImportPayslipCard';

/**
 * Asks for a protected PDF's password. It stays in this field until Open, is passed to the
 * reader once and then cleared: it is never stored, logged or sent anywhere.
 */
export function PasswordCard({
  file,
  wrong,
  onOpen,
  onSkip,
}: {
  file: string;
  wrong: boolean;
  onOpen: (password: string) => Promise<void>;
  onSkip: () => void;
}) {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (!password || busy) return;
    setBusy(true);
    const tried = password;
    setPassword('');
    await onOpen(tried);
    setBusy(false);
  };
  return (
    <ImportBox>
      <Text variant="bodyStrong">{file}</Text>
      <Text color="textSecondary">
        This PDF is password-protected. Payslip passwords are often your PAN in capitals or your
        date of birth (DDMMYYYY).
      </Text>
      <TextField
        label="PDF password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="off"
        onSubmitEditing={() => void open()}
        error={wrong ? 'That password did not open it. Try again.' : null}
        hint="Used only to open this file on this device; not kept."
      />
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        <Button
          label={busy ? 'Opening…' : 'Open'}
          size="sm"
          disabled={!password || busy}
          onPress={() => void open()}
        />
        <Button label="Skip this file" size="sm" variant="ghost" onPress={onSkip} />
      </View>
    </ImportBox>
  );
}
