import { forwardRef } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

/**
 * Text input for use inside a bottom sheet. On iOS and Android it lets the
 * sheet move up with the keyboard; react-native-web lacks the focus API that
 * relies on, so web falls back to a plain TextInput.
 */
export const SheetTextInput = forwardRef<TextInput, TextInputProps>((props, ref) =>
  Platform.OS === 'web' ? (
    <TextInput ref={ref} {...props} />
  ) : (
    <BottomSheetTextInput ref={ref as never} {...props} />
  ),
);
SheetTextInput.displayName = 'SheetTextInput';

/** BottomSheet props that move the sheet with the keyboard (native only, as above). */
export const sheetKeyboardProps =
  Platform.OS === 'web'
    ? {}
    : ({
        keyboardBehavior: 'interactive',
        keyboardBlurBehavior: 'restore',
        android_keyboardInputMode: 'adjustResize',
      } as const);
