import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import { UserPlus, Users } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { Button, Card, CardHeader, Money, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import type { PersonBalance } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type PeopleListCardProps = {
  balances: PersonBalance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Everyone you split with, and what each still owes you. */
export function PeopleListCard({
  balances,
  selectedId,
  onSelect,
  onAdd,
  style,
}: PeopleListCardProps) {
  const theme = useTheme();
  const owed = balances.reduce((sum, item) => sum + Math.max(0, item.outstanding), 0);
  return (
    <Card index={1} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader
        title="People"
        subtitle={owed ? `Owed to you ${formatMoneyWhole(owed)}` : 'Nobody owes you anything'}
        action={
          <Button label="Add" icon={UserPlus} size="sm" variant="secondary" onPress={onAdd} />
        }
      />
      {balances.length ? (
        <PanelScroll gap={2}>
          {balances.map((item) => (
            <PersonRow
              key={item.person.id}
              item={item}
              selected={item.person.id === selectedId}
              onPress={() => onSelect(item.person.id)}
            />
          ))}
        </PanelScroll>
      ) : (
        <EmptyState
          icon={Users}
          title="No people yet"
          body="Add the friends and family you share expenses with, then split an expense with them."
        />
      )}
    </Card>
  );
}

function PersonRow({
  item,
  selected,
  onPress,
}: {
  item: PersonBalance;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const { person, outstanding } = item;
  const status =
    outstanding > 0
      ? `owes you ${formatMoneyWhole(outstanding)}`
      : outstanding < 0
        ? `paid ${formatMoneyWhole(-outstanding)} more than owed`
        : 'all settled';
  return (
    <Pressable
      role="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${person.name}, ${status}`}
      onPress={onPress}
      {...handlers}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          padding: theme.space[2],
          borderRadius: theme.radius.md,
          backgroundColor: selected || hovered ? theme.colors.surfaceMuted : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <View
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.tints[person.order % theme.colors.tints.length].bg,
        }}
      >
        <Text
          variant="bodyStrong"
          style={{ color: theme.colors.tints[person.order % theme.colors.tints.length].fg }}
        >
          {person.name.slice(0, 1).toLocaleUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" numberOfLines={1}>
          {person.name}
        </Text>
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {status}
        </Text>
      </View>
      {outstanding > 0 ? <Money value={outstanding} whole variant="label" tone="income" /> : null}
    </Pressable>
  );
}
