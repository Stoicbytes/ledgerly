import { CircleAlert, RotateCw } from '@/components/icons';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

type ErrorStateProps = {
  title?: string;
  /** User-facing explanation. Never include raw error messages or IDs. */
  body?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Something went wrong',
  body = 'Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  const theme = useTheme();
  return (
    <View
      role="alert"
      style={{ alignItems: 'center', padding: theme.space[8], gap: theme.space[3] }}
    >
      <CircleAlert size={28} color={theme.colors.danger} strokeWidth={1.75} aria-hidden />
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text color="textSecondary" align="center">
        {body}
      </Text>
      {onRetry ? (
        <Button label="Try again" variant="secondary" icon={RotateCw} onPress={onRetry} />
      ) : null}
    </View>
  );
}
