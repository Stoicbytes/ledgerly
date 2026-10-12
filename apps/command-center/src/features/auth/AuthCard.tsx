import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { BrandMark } from '@/features/shell/BrandMark';
import { useTheme } from '@/theme';

type AuthCardProps = { title: string; description?: string; children: ReactNode };

/** Centred card used by the sign-in, forgot-password and reset-password screens. */
export function AuthCard({ title, description, children }: AuthCardProps) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.space[4],
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: '100%', maxWidth: 400, gap: theme.space[4] }}>
        <View style={{ alignItems: 'center' }}>
          <BrandMark size={40} />
        </View>
        <Card style={{ gap: theme.space[4] }}>
          <View style={{ gap: theme.space[1] }}>
            <Text variant="h2" role="heading">
              {title}
            </Text>
            {description ? <Text color="textSecondary">{description}</Text> : null}
          </View>
          {children}
        </Card>
      </View>
    </ScrollView>
  );
}

/** Error or confirmation line announced to screen readers. */
export function FormMessage({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <Text
      role={tone === 'error' ? 'alert' : 'status'}
      color={tone === 'error' ? 'danger' : 'textSecondary'}
      variant="label"
    >
      {children}
    </Text>
  );
}
