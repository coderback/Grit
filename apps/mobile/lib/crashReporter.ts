import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API = process.env.EXPO_PUBLIC_API_URL;
// Don't flood the backend if something throws in a loop
const MAX_PER_SESSION = 10;
let sent = 0;
let currentScreen: string | undefined;

/** The route the user is on, sent with crash reports. */
export function setCrashScreen(screen: string) {
  currentScreen = screen;
}

/**
 * Sends a crash to the backend's logs (POST /client-errors). Never throws:
 * reporting a crash must not cause another. Works signed out, since a crash
 * can happen before sign-in. Nothing personal is sent: the error, the screen
 * and the app version.
 */
export function reportCrash(error: unknown) {
  if (!API || sent >= MAX_PER_SESSION) return;
  sent++;
  const err = error instanceof Error ? error : new Error(String(error));
  fetch(`${API}/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `${err.name}: ${err.message}`.slice(0, 500),
      stack: err.stack?.slice(0, 4000),
      screen: currentScreen?.slice(0, 200),
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
      appVersion: Constants.expoConfig?.version,
    }),
  }).catch(() => {});
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

/** Reports uncaught JavaScript errors as well, then lets React Native handle them as before. */
export function installGlobalCrashHandler() {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): GlobalHandler; setGlobalHandler(h: GlobalHandler): void };
  };
  const utils = g.ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    reportCrash(error);
    previous(error, isFatal);
  });
}
