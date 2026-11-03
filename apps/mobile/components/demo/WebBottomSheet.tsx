/**
 * Demo-build stand-in for @gorhom/bottom-sheet. The library's gestures block touch
 * scrolling in mobile browsers, which left sheet buttons out of reach, so metro.config.js
 * swaps in this version for the web demo. The native app keeps using the real library.
 */
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { ScrollViewProps, ViewProps, ViewStyle } from 'react-native';

export interface BottomSheetHandle {
  expand: () => void;
  close: () => void;
}

interface Props {
  index?: number;
  snapPoints?: string[];
  onClose?: () => void;
  backgroundStyle?: ViewStyle;
  handleIndicatorStyle?: ViewStyle;
  children?: React.ReactNode;
  enablePanDownToClose?: boolean;
}

const TAB_BAR_CLEARANCE = 96;

const BottomSheet = forwardRef<BottomSheetHandle, Props>(function BottomSheet(
  { index = 0, snapPoints, onClose, backgroundStyle, handleIndicatorStyle, children },
  ref,
) {
  const [open, setOpen] = useState(index !== -1);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  useImperativeHandle(ref, () => ({ expand: () => setOpen(true), close }));

  if (!open) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={close}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
      />
      <View
        accessibilityViewIsModal
        style={[{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: (snapPoints?.[0] ?? '70%') as ViewStyle['maxHeight'],
          minHeight: '40%',
          paddingBottom: TAB_BAR_CLEARANCE,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: 'hidden',
        }, backgroundStyle]}
      >
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={[{ width: 40, height: 4, borderRadius: 2 }, handleIndicatorStyle]} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
});

export default BottomSheet;

export function BottomSheetView({ children, ...rest }: ViewProps) {
  return <View {...rest}>{children}</View>;
}

export function BottomSheetScrollView({ children, contentContainerStyle, style }: ScrollViewProps) {
  return <View style={[style, contentContainerStyle]}>{children}</View>;
}
