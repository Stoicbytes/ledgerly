import { View } from 'react-native';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { Section } from '@/components/layout/Section';
import { Card, Text } from '@/components/ui';
import { useTheme, type ColorRoles } from '@/theme';

const roles: (keyof ColorRoles)[] = [
  'accent',
  'income',
  'expense',
  'transfer',
  'investment',
  'success',
  'warning',
  'danger',
  'info',
  'textPrimary',
  'textSecondary',
  'borderStrong',
];

export function ColorsSection() {
  const theme = useTheme();
  return (
    <Section
      title="Colour roles"
      description="Semantic roles only; components never use raw hex values."
    >
      <ResponsiveGrid columns={{ sm: 2, md: 4, lg: 6 }}>
        {roles.map((role) => (
          <Card key={role} padding={3}>
            <View
              aria-hidden
              style={{
                height: 36,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors[role] as string,
              }}
            />
            <Text variant="caption" color="textSecondary" style={{ marginTop: theme.space[2] }}>
              {role}
            </Text>
          </Card>
        ))}
      </ResponsiveGrid>
      <Card>
        <Text variant="label" color="textSecondary">
          Chart series (fixed order, CVD-validated)
        </Text>
        <View
          style={{
            flexDirection: 'row',
            gap: theme.space[2],
            marginTop: theme.space[2],
            flexWrap: 'wrap',
          }}
        >
          {theme.colors.chart.map((color, index) => (
            <View key={color} style={{ alignItems: 'center', gap: 4 }}>
              <View
                aria-hidden
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.sm,
                  backgroundColor: color,
                }}
              />
              <Text variant="caption" color="textTertiary">
                {index + 1}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Section>
  );
}
