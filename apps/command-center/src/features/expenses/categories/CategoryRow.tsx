import { Pressable, View } from 'react-native';
import { ChevronDown, ChevronRight, ChevronUp } from '@/components/icons';
import { CategoryIcon, IconButton, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import type { Category } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { iconFor } from '../categoryIcons';

type CategoryRowProps = {
  category: Category;
  subcategories: Category[];
  entries: number;
  showSubcategories: boolean;
  selected: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
  onMove: (direction: -1 | 1) => void;
};

/** "Food · 15 subcategories · 159 entries" with a preview of the subcategories and reorder arrows. */
export function CategoryRow(props: CategoryRowProps) {
  const { category, subcategories, entries, showSubcategories, selected, first, last } = props;
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const facts = [
    showSubcategories && subcategories.length
      ? `${subcategories.length} ${subcategories.length === 1 ? 'subcategory' : 'subcategories'}`
      : null,
    `${entries} ${entries === 1 ? 'entry' : 'entries'}`,
  ].filter(Boolean);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: theme.radius.md,
        backgroundColor: selected || hovered ? theme.colors.surfaceMuted : 'transparent',
      }}
    >
      <Pressable
        role="button"
        accessibilityLabel={`${category.name}, ${facts.join(', ')}`}
        accessibilityState={{ selected }}
        onPress={props.onPress}
        {...handlers}
        style={[
          {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[3],
            padding: theme.space[2],
            borderRadius: theme.radius.md,
          },
          focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
        ]}
      >
        <CategoryIcon icon={iconFor(category.icon)} tint={category.tint} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {category.name}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {facts.join(' · ')}
          </Text>
          {showSubcategories && subcategories.length ? (
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {subcategories.map((sub) => sub.name).join(', ')}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={theme.colors.textTertiary} />
      </Pressable>
      <View style={{ flexDirection: 'row' }}>
        <IconButton
          icon={ChevronUp}
          size="sm"
          disabled={first}
          accessibilityLabel={`Move ${category.name} up`}
          onPress={() => props.onMove(-1)}
        />
        <IconButton
          icon={ChevronDown}
          size="sm"
          disabled={last}
          accessibilityLabel={`Move ${category.name} down`}
          onPress={() => props.onMove(1)}
        />
      </View>
    </View>
  );
}
