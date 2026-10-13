import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** One tappable row: a title and detail on the left, a value and note on the right. */
export function ListRow({
  title,
  detail,
  value,
  valueNote,
  onPress,
}: {
  title: string;
  detail?: string;
  value?: string;
  valueNote?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, detail, value].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        paddingVertical: theme.space[3],
        paddingHorizontal: theme.space[2],
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {value ? <Text variant="bodyStrong">{value}</Text> : null}
        {valueNote ? (
          <Text variant="caption" color="textSecondary">
            {valueNote}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
