import { Pressable } from 'react-native';
import { ChevronDown, ChevronUp } from '@/components/icons';
import { CategoryIcon, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import type { Category } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { iconFor } from '../categoryIcons';

type CategoryTileProps = {
  category: Category;
  /** Shown under the name in search results (the parent of a subcategory). */
  caption?: string;
  selected: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onPress: () => void;
};

/** Icon tile in the category grid; a parent with subcategories shows a chevron. */
export function CategoryTile({
  category,
  caption,
  selected,
  expandable,
  expanded,
  onPress,
}: CategoryTileProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <Pressable
      role="button"
      accessibilityLabel={[caption, category.name].filter(Boolean).join(', ')}
      accessibilityHint={expandable ? 'Shows its subcategories' : undefined}
      accessibilityState={{ selected, expanded: expandable ? !!expanded : undefined }}
      onPress={onPress}
      {...handlers}
      style={[
        {
          alignItems: 'center',
          gap: 6,
          paddingVertical: theme.space[2] + 2,
          paddingHorizontal: 4,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: selected ? theme.colors.ink : 'transparent',
          backgroundColor: expanded || hovered ? theme.colors.surfaceMuted : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <CategoryIcon icon={iconFor(category.icon)} tint={category.tint} size={40} />
      <Text variant="caption" align="center" numberOfLines={2}>
        {category.name}
      </Text>
      {caption ? (
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      {expandable ? <Chevron size={14} color={theme.colors.textTertiary} /> : null}
    </Pressable>
  );
}
