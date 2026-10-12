import { useId, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme';

type ScrollRowProps = {
  children: ReactNode;
  accessibilityLabel?: string;
  /** Colour behind the row; the edge fades blend into it. Defaults to the card surface. */
  background?: string;
  /** Where items sit when they all fit. */
  align?: 'start' | 'end';
  gap?: number;
};

/**
 * Horizontally scrolling row for chips and filters. When items overflow, the
 * clipped edge fades out so the row reads as scrollable instead of cut off.
 */
export function ScrollRow({
  children,
  accessibilityLabel,
  background,
  align = 'start',
  gap = 8,
}: ScrollRowProps) {
  const theme = useTheme();
  const [viewWidth, setViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const color = background ?? theme.colors.surface;
  const overflow = contentWidth > viewWidth + 1;
  return (
    <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={accessibilityLabel}
        onLayout={(event) => setViewWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
          gap,
          paddingVertical: 6,
          paddingHorizontal: 2,
        }}
      >
        {children}
      </ScrollView>
      {overflow && offset > 1 ? <EdgeFade side="left" color={color} /> : null}
      {overflow && offset + viewWidth < contentWidth - 1 ? (
        <EdgeFade side="right" color={color} />
      ) : null}
    </View>
  );
}

function EdgeFade({ side, color }: { side: 'left' | 'right'; color: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const left = side === 'left';
  return (
    <Svg
      width={36}
      height="100%"
      aria-hidden
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: left ? 0 : undefined,
        right: left ? undefined : 0,
      }}
    >
      <Defs>
        <LinearGradient id={`fade${id}`} x1={left ? '1' : '0'} y1="0" x2={left ? '0' : '1'} y2="0">
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="0.7" stopColor={color} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#fade${id})`} />
    </Svg>
  );
}
