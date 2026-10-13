import { ErrorBoundary as RouterErrorBoundary, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { reloadForUpdate } from './staleBuild';

/** Expo Router's error screen; a screen file missing after a new deploy reloads instead. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => {
    reloadForUpdate(props.error);
  }, [props.error]);
  return <RouterErrorBoundary {...props} />;
}
