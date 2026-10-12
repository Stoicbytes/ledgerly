import { View } from 'react-native';
import { Section } from '@/components/layout/Section';
import { Card, Text } from '@/components/ui';
import { useTheme, type TypeVariant } from '@/theme';

const variants: TypeVariant[] = [
  'display',
  'h1',
  'h2',
  'title',
  'bodyLg',
  'body',
  'bodyStrong',
  'label',
  'caption',
  'eyebrow',
];

export function TypographySection() {
  const theme = useTheme();
  return (
    <Section
      title="Typography"
      description="Inter with tabular figures for numbers. Nothing below 12px."
    >
      <Card>
        <View style={{ gap: theme.space[3] }}>
          {variants.map((variant) => (
            <View
              key={variant}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: theme.space[4],
                flexWrap: 'wrap',
              }}
            >
              <Text variant="caption" color="textTertiary" style={{ width: 88 }}>
                {variant} · {theme.type[variant].fontSize}
              </Text>
              <Text variant={variant} style={{ flexShrink: 1 }}>
                Net worth grew this month
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Section>
  );
}
