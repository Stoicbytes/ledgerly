import { View } from 'react-native';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { Section } from '@/components/layout/Section';
import {
  Badge,
  Card,
  Delta,
  Money,
  ProgressBar,
  ProgressRing,
  Skeleton,
  Text,
} from '@/components/ui';
import { useTheme } from '@/theme';

/** Sample KPI tiles: values are fixed illustrations, not user data. */
const samples = [
  { label: 'Income', value: 8_500_000, tone: 'income', delta: 4.2, goodWhen: 'up' },
  { label: 'Expenses', value: 4_312_550, tone: 'expense', delta: 18.4, goodWhen: 'down' },
  { label: 'Net', value: 4_187_450, tone: 'auto', delta: -6.1, goodWhen: 'up' },
  { label: 'Portfolio gain', value: -1_250_000, tone: 'auto', delta: 0, goodWhen: 'up' },
] as const;

export function DataSection() {
  const theme = useTheme();
  return (
    <Section
      title="Data display"
      description="Gain and loss always carry a sign and arrow, never colour alone."
    >
      <ResponsiveGrid columns={{ sm: 1, md: 2, lg: 4 }}>
        {samples.map((sample) => (
          <Card key={sample.label}>
            <View style={{ gap: theme.space[2] }}>
              <Text variant="label" color="textSecondary">
                {sample.label}
              </Text>
              <Money value={sample.value} tone={sample.tone} variant="h2" />
              <Delta value={sample.delta} goodWhen={sample.goodWhen} comparison="vs Sep" />
            </View>
          </Card>
        ))}
      </ResponsiveGrid>
      <ResponsiveGrid columns={{ sm: 1, md: 3 }}>
        <Card>
          <View style={{ gap: theme.space[3] }}>
            <Text variant="label" color="textSecondary">
              Badges
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
              <Badge label="Neutral" />
              <Badge label="Active" tone="success" />
              <Badge label="Stale NAV" tone="warning" />
              <Badge label="Over budget" tone="danger" />
              <Badge label="Info" tone="info" />
              <Badge label="SIP" tone="investment" />
            </View>
          </View>
        </Card>
        <Card>
          <View style={{ gap: theme.space[3] }}>
            <Text variant="label" color="textSecondary">
              Progress
            </Text>
            <ProgressBar value={0.62} accessibilityLabel="Food budget used" />
            <ProgressBar value={0.94} tone="warning" accessibilityLabel="Shopping budget used" />
            <ProgressRing
              value={0.45}
              accessibilityLabel="Emergency fund progress"
              tone="investment"
            >
              <Text variant="bodyStrong" numeric>
                45%
              </Text>
            </ProgressRing>
          </View>
        </Card>
        <Card>
          <View role="status" accessibilityLabel="Loading example" style={{ gap: theme.space[3] }}>
            <Text variant="label" color="textSecondary">
              Skeleton
            </Text>
            <Skeleton width="40%" height={14} />
            <Skeleton height={32} />
            <Skeleton width="70%" height={14} />
          </View>
        </Card>
      </ResponsiveGrid>
    </Section>
  );
}
