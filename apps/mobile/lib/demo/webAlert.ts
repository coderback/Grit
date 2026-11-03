import { Alert, Platform } from 'react-native';
import type { AlertButton } from 'react-native';

/** React Native Web's Alert.alert does nothing, so route it to the browser's dialogs. */
export function installWebAlert() {
  if (Platform.OS !== 'web') return;
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length < 2) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
    const action = buttons.find((b) => b !== cancel) ?? buttons[buttons.length - 1];
    if (window.confirm(text)) action.onPress?.();
    else cancel.onPress?.();
  };
}
