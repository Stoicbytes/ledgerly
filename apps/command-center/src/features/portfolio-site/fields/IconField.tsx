import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { SKILL_ICONS } from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { SKILL_ICON_COMPONENTS } from './skillIcons';

/** Choose one of the built-in icons, or none (the site then shows the initials). */
export function IconField({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const theme = useTheme();
  const cell = (selected: boolean) => ({
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: selected ? theme.colors.accent : theme.colors.border,
    backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
  });
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">
        Icon
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} role="radiogroup">
        <Pressable
          role="radio"
          aria-checked={!value}
          accessibilityLabel="No icon (initials)"
          onPress={() => onChange('')}
          style={cell(!value)}
        >
          <Text variant="caption" color="textSecondary">
            Aa
          </Text>
        </Pressable>
        {SKILL_ICONS.map((name) => {
          const Icon = SKILL_ICON_COMPONENTS[name];
          return (
            <Pressable
              key={name}
              role="radio"
              aria-checked={value === name}
              accessibilityLabel={name.replace(/-/g, ' ')}
              onPress={() => onChange(name)}
              style={cell(value === name)}
            >
              <Icon
                size={18}
                color={value === name ? theme.colors.accent : theme.colors.textSecondary}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
