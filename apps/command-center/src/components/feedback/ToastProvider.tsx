import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { layout, useTheme } from '@/theme';
import { Appear } from '../ui/Appear';
import { Text } from '../ui/Text';

export type ToastInput = {
  message: string;
  /** e.g. Undo. Toasts with an action stay up longer so it can be reached. */
  action?: { label: string; onPress: () => void };
  durationMs?: number;
};

type ToastContextValue = { show: (toast: ToastInput) => void; dismiss: () => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const nextId = useRef(0);
  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((input: ToastInput) => setToast({ ...input, id: ++nextId.current }), []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(dismiss, toast.durationMs ?? (toast.action ? 6000 : 3000));
    return () => clearTimeout(timeout);
  }, [toast, dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: (ToastInput & { id: number }) | null;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile } = useBreakpoint();
  const bottom = insets.bottom + theme.space[4] + (isMobile ? layout.bottomBarHeight : 0);
  return (
    <View
      pointerEvents="box-none"
      aria-live="polite"
      role="status"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        alignItems: 'center',
        paddingHorizontal: theme.space[4],
      }}
    >
      {toast ? (
        <Appear
          key={toast.id}
          rise={12}
          duration={200}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[4],
            maxWidth: 560,
            backgroundColor: theme.colors.inverseSurface,
            borderRadius: theme.radius.md,
            paddingVertical: theme.space[3],
            paddingHorizontal: theme.space[4],
            ...theme.elevation(3),
          }}
        >
          <Text color="onInverseSurface" style={{ flexShrink: 1 }}>
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              role="button"
              hitSlop={12}
              onPress={() => {
                toast.action?.onPress();
                onDismiss();
              }}
            >
              <Text variant="bodyStrong" color="inverseAccent">
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}
        </Appear>
      ) : null}
    </View>
  );
}
