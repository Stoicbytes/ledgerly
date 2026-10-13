import { View } from 'react-native';
import { CircleAlert, CircleCheck, Lightbulb } from '@/components/icons';
import { Card, CardHeader, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Insight } from './insights';

/** What stands out this month, most pressing first. Hidden when there is nothing to say. */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const theme = useTheme();
  if (!insights.length) return null;
  const icon = { warn: CircleAlert, good: CircleCheck, info: Lightbulb } as const;
  const color = {
    warn: theme.colors.warning,
    good: theme.colors.success,
    info: theme.colors.info,
  } as const;
  return (
    <Card style={{ gap: theme.space[3] }}>
      <CardHeader title="Insights" subtitle="Worked out from your own entries this month" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
        {insights.map((item) => {
          const Icon = icon[item.tone];
          return (
            <View
              key={item.id}
              accessibilityLabel={`${item.title}. ${item.detail}`}
              style={{
                flexBasis: 260,
                flexGrow: 1,
                flexDirection: 'row',
                gap: theme.space[3],
                padding: theme.space[3],
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            >
              <Icon size={18} color={color[item.tone]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{item.title}</Text>
                <Text variant="caption" color="textSecondary">
                  {item.detail}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
