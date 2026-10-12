import type { LucideIcon } from '@/components/icons';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
};

/** Contextual empty state: says what is missing and offers the next step. */
export function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: theme.space[10],
        paddingHorizontal: theme.space[6],
        gap: theme.space[3],
      }}
    >
      <View
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={26} color={theme.colors.accent} strokeWidth={1.75} />
      </View>
      <Text variant="title" align="center">
        {title}
      </Text>
      {body ? (
        <Text color="textSecondary" align="center" style={{ maxWidth: 420 }}>
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
