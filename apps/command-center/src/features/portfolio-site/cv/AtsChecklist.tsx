import { View } from 'react-native';
import { CircleAlert, CircleCheck } from '@/components/icons';
import { Text } from '@/components/ui';
import type { AtsReport } from '@/lib/domain/cv';
import { useTheme } from '@/theme';

export const scoreLabel = (score: number) =>
  score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs work';

/** The score, each check with what to do about it, and missing job keywords. */
export function AtsChecklist({ report }: { report: AtsReport }) {
  const theme = useTheme();
  const tone = report.score >= 85 ? 'success' : report.score >= 70 ? 'textPrimary' : 'warning';
  return (
    <View style={{ gap: theme.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}>
        <Text
          variant="figure"
          color={tone}
          accessibilityLabel={`ATS readiness ${report.score} out of 100`}
        >
          {report.score}
        </Text>
        <Text color="textSecondary">/ 100 · {scoreLabel(report.score)}</Text>
      </View>
      <View style={{ gap: theme.space[2] }}>
        {report.checks.map((check) => {
          const Icon = check.ok ? CircleCheck : CircleAlert;
          return (
            <View key={check.id} style={{ flexDirection: 'row', gap: theme.space[2] }}>
              <Icon size={18} color={check.ok ? theme.colors.success : theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text variant="body">{check.label}</Text>
                {!check.ok && check.tip ? (
                  <Text variant="caption" color="textSecondary">
                    {check.tip}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      {report.keywords?.missing.length ? (
        <Text variant="caption" color="textSecondary">
          {`Missing from your CV: ${report.keywords.missing.join(', ')}.`}
        </Text>
      ) : null}
    </View>
  );
}
