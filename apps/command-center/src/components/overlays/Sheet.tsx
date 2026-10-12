import { X } from '@/components/icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useMotion, useTheme } from '@/theme';
import { IconButton } from '../ui/IconButton';
import { Text } from '../ui/Text';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Desktop dialog width. */
  width?: number;
};

/**
 * One overlay API for every platform: a bottom sheet on phones and a centred
 * dialog on tablet/desktop. React Native Web's Modal provides the dialog role,
 * focus containment and Escape-to-close (via onRequestClose); Android's back
 * button also maps to onRequestClose.
 */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile } = useBreakpoint();
  const { reduceMotion } = useMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{ flex: 1, justifyContent: isMobile ? 'flex-end' : 'center', alignItems: 'center' }}
      >
        <Pressable
          accessibilityLabel="Close"
          role="button"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: theme.colors.scrim,
          }}
        />
        <View
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          aria-label={title}
          style={{
            width: isMobile ? '100%' : width,
            maxWidth: '100%',
            maxHeight: isMobile ? '92%' : '85%',
            backgroundColor: theme.colors.surfaceRaised,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            borderBottomLeftRadius: isMobile ? 0 : theme.radius.xl,
            borderBottomRightRadius: isMobile ? 0 : theme.radius.xl,
            paddingBottom: isMobile ? insets.bottom : 0,
            ...theme.elevation(3),
          }}
        >
          {isMobile ? (
            <View
              aria-hidden
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                marginTop: theme.space[2],
                backgroundColor: theme.colors.border,
              }}
            />
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: theme.space[3],
              padding: theme.space[5],
              paddingBottom: theme.space[3],
            }}
          >
            <View style={{ flex: 1, gap: theme.space[1] }}>
              <Text variant="title" role="heading">
                {title}
              </Text>
              {description ? <Text color="textSecondary">{description}</Text> : null}
            </View>
            <IconButton icon={X} accessibilityLabel="Close" onPress={onClose} />
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.space[5],
              paddingBottom: theme.space[5],
            }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: theme.space[2],
                padding: theme.space[4],
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
