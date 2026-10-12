import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/** Measures the chart container so SVG coordinates match real pixels. */
export function useChartSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };
  return { ...size, onLayout };
}
