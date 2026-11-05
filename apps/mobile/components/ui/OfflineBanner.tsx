import React, { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

const subscribe = (cb: () => void) => onlineManager.subscribe(cb);
const isOnline = () => onlineManager.isOnline();
// The floating tab bar's height plus its gap from the bottom edge
const TAB_BAR_CLEARANCE = 84;

/**
 * A strip near the bottom while there's no connection, above the floating
 * tab bar. It doesn't take touches, so nothing under it is blocked.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, isOnline, isOnline);
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ pointerEvents: 'none', position: 'absolute', bottom: Math.max(insets.bottom, 12) + TAB_BAR_CLEARANCE, left: 16, right: 16, zIndex: 999, backgroundColor: Colors.surface3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 9 }}
    >
      <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 13, textAlign: 'center' }}>
        You're offline. Showing your last saved data; changes need a connection.
      </Text>
    </View>
  );
}
