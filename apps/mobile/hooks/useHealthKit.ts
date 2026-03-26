/**
 * Health data integration — Apple HealthKit (iOS) + Google Health Connect (Android)
 *
 * ⚠️  REQUIRES BARE WORKFLOW
 * These packages use native modules that are NOT available in Expo Go or the
 * managed workflow. To activate:
 *   1. Run: npx expo prebuild
 *   2. For iOS: cd apps/mobile/ios && pod install
 *   3. Add entitlement in Xcode: HealthKit capability
 *   4. Uncomment the imports and real implementation below
 *
 * Until then, the hook returns empty/safe defaults so the rest of the app compiles.
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

// ─── Bare-workflow implementation (uncomment after prebuild) ─────────────────
// import AppleHealthKit, { HealthKitPermissions, HealthUnit } from 'react-native-health';
// import { initialize, requestPermission, readRecords } from 'react-native-health-connect';

export interface HealthSyncResult {
  steps: number;
  activeMinutes: number;
}

export function useHealthKit() {
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // TODO: uncomment after `npx expo prebuild`
    // if (Platform.OS === 'ios') {
    //   return new Promise((resolve) => {
    //     AppleHealthKit.initHealthKit(IOS_PERMISSIONS, (err) => resolve(!err));
    //   });
    // }
    // if (Platform.OS === 'android') {
    //   await initialize();
    //   const granted = await requestPermission([
    //     { accessType: 'read', recordType: 'Steps' },
    //     { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    //   ]);
    //   return granted;
    // }
    console.warn('[HealthKit] Native modules not available — run expo prebuild first.');
    return false;
  }, []);

  const syncToday = useCallback(async (): Promise<HealthSyncResult> => {
    // TODO: uncomment after prebuild
    // if (Platform.OS === 'ios') {
    //   const steps = await getIosSteps();
    //   const activeMin = await getIosActiveMinutes();
    //   if (steps > 0 || activeMin > 0) {
    //     await api.post('/activity-logs', {
    //       activityType: 'walking',
    //       durationMin: activeMin,
    //       steps,
    //       source: 'healthkit',
    //     });
    //   }
    //   return { steps, activeMinutes: activeMin };
    // }
    // if (Platform.OS === 'android') {
    //   const stepsResult = await readRecords('Steps', { timeRangeFilter: todayRange() });
    //   const steps = stepsResult.reduce((s, r) => s + r.count, 0);
    //   await api.post('/activity-logs', { activityType: 'walking', durationMin: 0, steps, source: 'health_connect' });
    //   return { steps, activeMinutes: 0 };
    // }
    return { steps: 0, activeMinutes: 0 };
  }, []);

  return { requestPermissions, syncToday };
}

// ─── iOS helper stubs (uncomment after prebuild) ─────────────────────────────
// const IOS_PERMISSIONS: HealthKitPermissions = {
//   permissions: {
//     read: [AppleHealthKit.Constants.Permissions.Steps, AppleHealthKit.Constants.Permissions.ActiveEnergyBurned],
//     write: [],
//   },
// };
//
// function getIosSteps(): Promise<number> {
//   return new Promise((resolve) => {
//     const options = { date: new Date().toISOString(), includeManuallyAdded: false };
//     AppleHealthKit.getStepCount(options, (err, result) => resolve(err ? 0 : result.value));
//   });
// }
//
// function getIosActiveMinutes(): Promise<number> {
//   return new Promise((resolve) => {
//     const now = new Date();
//     const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
//     AppleHealthKit.getActiveEnergyBurned(
//       { startDate: startOfDay.toISOString(), endDate: now.toISOString() },
//       (err, results) => resolve(err ? 0 : Math.round(results.reduce((s, r) => s + r.value, 0) / 5)),
//     );
//   });
// }
//
// function todayRange() {
//   const now = new Date();
//   const start = new Date(now); start.setHours(0, 0, 0, 0);
//   return { operator: 'between' as const, startTime: start.toISOString(), endTime: now.toISOString() };
// }
