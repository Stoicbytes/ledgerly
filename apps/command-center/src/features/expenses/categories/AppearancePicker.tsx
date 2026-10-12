import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Check } from '@/components/icons';
import { Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useTheme } from '@/theme';
import { categoryIconKeys, iconFor } from '../categoryIcons';

type AppearancePickerProps = {
  icon: string;
  tint: number;
  onIcon: (icon: string) => void;
  onTint: (tint: number) => void;
};

/** Icon grid and colour swatches for a category. */
export function AppearancePicker({ icon, tint, onIcon, onTint }: AppearancePickerProps) {
  const theme = useTheme();
  const swatch = theme.colors.tints[tint % theme.colors.tints.length];
  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="label" color="textSecondary">
        Colour
      </Text>
      <View
        role="radiogroup"
        accessibilityLabel="Colour"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}
      >
        {theme.colors.tints.map((colors, index) => (
          <Choice
            key={index}
            label={`Colour ${index + 1}`}
            selected={index === tint}
            onPress={() => onTint(index)}
            background={colors.bg}
            ring={colors.fg}
          >
            {index === tint ? <Check size={16} color={colors.fg} strokeWidth={2.6} /> : null}
          </Choice>
        ))}
      </View>
      <Text variant="label" color="textSecondary">
        Icon
      </Text>
      <View
        role="radiogroup"
        accessibilityLabel="Icon"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}
      >
        {categoryIconKeys.map((key) => {
          const Icon = iconFor(key);
          return (
            <Choice
              key={key}
              label={`${key} icon`}
              selected={key === icon}
              onPress={() => onIcon(key)}
              background={key === icon ? swatch.bg : theme.colors.surfaceMuted}
              ring={swatch.fg}
            >
              <Icon
                size={18}
                color={key === icon ? swatch.fg : theme.colors.textSecondary}
                strokeWidth={2}
              />
            </Choice>
          );
        })}
      </View>
    </View>
  );
}

type ChoiceProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  background: string;
  ring: string;
  children?: ReactNode;
};

function Choice({ label, selected, onPress, background, ring, children }: ChoiceProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...handlers}
      style={[
        {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
          borderWidth: 2,
          borderColor: selected ? ring : hovered ? theme.colors.border : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      {children}
    </Pressable>
  );
}
