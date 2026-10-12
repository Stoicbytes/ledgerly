import { useState } from 'react';
import { Animated, Pressable, View, type LayoutRectangle } from 'react-native';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator';
import { useTheme, type ColorRoles } from '@/theme';
import { Text } from './Text';

type SegmentTone = Extract<
  keyof ColorRoles,
  'accent' | 'income' | 'expense' | 'transfer' | 'investment'
>;

export type Segment<T extends string> = { value: T; label: string; tone?: SegmentTone };

type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** Stretch segments to fill the width (forms) or size to content (toolbars). */
  fill?: boolean;
  size?: 'sm' | 'md';
};

/**
 * Pill-shaped single choice with a thumb that slides to the selection.
 * Exposed as a radio group; the selected segment is `checked`.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  fill = true,
  size = 'md',
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const thumb = useSlidingIndicator(layouts[value]);

  return (
    <View
      role="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignSelf: fill ? 'stretch' : 'flex-start',
        padding: 4,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <Animated.View
        aria-hidden
        style={[
          {
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 0,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surface,
            ...theme.elevation(2),
          },
          {
            opacity: thumb.visible ? 1 : 0,
            width: thumb.width,
            transform: [{ translateX: thumb.x }],
          },
        ]}
      />
      {segments.map((segment) => (
        <SegmentButton
          key={segment.value}
          segment={segment}
          fill={fill}
          size={size}
          selected={segment.value === value}
          onPress={() => onChange(segment.value)}
          onLayout={(layout) => setLayouts((current) => ({ ...current, [segment.value]: layout }))}
        />
      ))}
    </View>
  );
}

function SegmentButton<T extends string>({
  segment,
  selected,
  fill,
  size,
  onPress,
  onLayout,
}: {
  segment: Segment<T>;
  selected: boolean;
  fill: boolean;
  size: 'sm' | 'md';
  onPress: () => void;
  onLayout: (layout: LayoutRectangle) => void;
}) {
  const theme = useTheme();
  const { focused, handlers } = useInteractionState();
  const tone = segment.tone;
  return (
    <Pressable
      role="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      onLayout={(event) => onLayout(event.nativeEvent.layout)}
      {...handlers}
      style={[
        {
          flex: fill ? 1 : undefined,
          minHeight: size === 'sm' ? 28 : 34,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.space[size === 'sm' ? 3 : 4],
          borderRadius: theme.radius.pill,
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <Text
        variant={
          selected ? (size === 'sm' ? 'label' : 'bodyStrong') : size === 'sm' ? 'label' : 'body'
        }
        color={selected ? (tone ?? 'textPrimary') : 'textSecondary'}
        numberOfLines={1}
      >
        {segment.label}
      </Text>
    </Pressable>
  );
}
