import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { type ReactNode, type Ref, useCallback } from 'react';
import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { useUnistyles } from 'react-native-unistyles';

export type SheetRef = BottomSheetModal;

export type SheetProps = {
  ref?: Ref<BottomSheetModal>;
  children: ReactNode;
  onDismiss?: () => void;
};

// On iOS the sheet's portal sits under native-stack modals, so a sheet opened from a modal screen would
// render behind it. FullWindowOverlay puts it above every native view. Android doesn't need it.
const container =
  Platform.OS === 'ios'
    ? ({ children }: { children?: ReactNode }) => <FullWindowOverlay>{children}</FullWindowOverlay>
    : undefined;

/** Modal bottom sheet sized to its content. Open with `ref.current?.present()`. */
export function Sheet({ ref, children, onDismiss }: SheetProps) {
  const { theme, rt } = useUnistyles();
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );
  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={onDismiss}
      containerComponent={container}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      // A bottom-sheet library prop, not React Native's: drops its untranslated "Bottom Sheet" label.
      // eslint-disable-next-line no-restricted-syntax
      accessibilityLabel={undefined}
    >
      <BottomSheetView
        style={{
          padding: theme.spacing.xl,
          paddingBottom: rt.insets.bottom + theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
      >
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
