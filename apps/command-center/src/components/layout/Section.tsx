import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Heading, Text } from '../ui/Text';

type SectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Section({ title, description, action, children }: SectionProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space[3] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: theme.space[3],
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Heading level={3}>{title}</Heading>
          {description ? (
            <Text variant="label" color="textSecondary">
              {description}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
