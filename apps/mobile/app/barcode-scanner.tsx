import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFoodBarcode } from '@/hooks/useFoodLog';
import { LogFoodSheet } from '@/components/food/LogFoodSheet';
import { Colors } from '@/constants/colors';

export default function BarcodeScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const { data: food, isLoading, error } = useFoodBarcode(scannedCode);

  const handleBarcodeScan = useCallback(
    ({ data }: { data: string }) => {
      if (scannedCode) return; // debounce
      setScannedCode(data);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [scannedCode],
  );

  // When food data loads after a scan, open the log sheet
  React.useEffect(() => {
    if (food && scannedCode) {
      setShowSheet(true);
    }
  }, [food, scannedCode]);

  React.useEffect(() => {
    if (error && scannedCode) {
      Alert.alert(
        'Product not found',
        'No nutritional data found for this barcode. Would you like to log it manually?',
        [
          { text: 'Cancel', onPress: () => setScannedCode(null) },
          {
            text: 'Log manually',
            onPress: () => {
              setShowSheet(true); // opens sheet with empty food
            },
          },
        ],
      );
    }
  }, [error, scannedCode]);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionView}>
          <Text style={styles.permissionTitle}>Camera permission needed</Text>
          <Text style={styles.permissionBody}>
            GRIT uses the camera to scan food barcodes — free forever, never paywalled.
          </Text>
          <Pressable onPress={requestPermission} style={styles.permissionBtn}>
            <Text style={styles.permissionBtnText}>Allow camera access</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scannedCode ? undefined : handleBarcodeScan}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13', 'ean8', 'upc_a', 'upc_e',
            'code128', 'code39', 'qr',
          ],
        }}
      />

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay}>
        {/* Close button */}
        <Pressable
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 28 }}>×</Text>
        </Pressable>

        {/* Viewfinder box */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            {[
              styles.cornerTL, styles.cornerTR,
              styles.cornerBL, styles.cornerBR,
            ].map((corner, i) => (
              <View key={i} style={corner} />
            ))}
          </View>
          <Text style={styles.hint}>
            {scannedCode && isLoading
              ? 'Looking up product...'
              : 'Point at a barcode'}
          </Text>
        </View>

        {/* Rescan button */}
        {scannedCode && !showSheet && (
          <Pressable
            onPress={() => setScannedCode(null)}
            style={styles.rescanBtn}
          >
            <Text style={styles.rescanText}>Scan again</Text>
          </Pressable>
        )}
      </SafeAreaView>

      {showSheet && (
        <LogFoodSheet
          food={food ?? {
            offId: '',
            name: scannedCode ?? 'Unknown',
            brand: null,
            barcode: scannedCode,
            calories: 0,
            proteinG: 0,
            carbsG: 0,
            fatG: 0,
            servingQty: 1,
            servingUnit: 'serving',
            imageUrl: null,
          }}
          onClose={() => {
            setShowSheet(false);
            setScannedCode(null);
            router.back();
          }}
        />
      )}
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = Colors.orange;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  overlay: {
    flex: 1,
    paddingHorizontal: 24,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    padding: 8,
  },
  viewfinderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  viewfinder: {
    width: 260,
    height: 180,
    position: 'relative',
  },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
  },
  cornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  cornerTR: {
    position: 'absolute', top: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  cornerBL: {
    position: 'absolute', bottom: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  cornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
  },
  permissionView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    color: Colors.text,
    fontFamily: 'DMSans-Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  permissionBody: {
    color: Colors.muted,
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  rescanBtn: {
    alignSelf: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
  },
  rescanText: {
    color: '#fff',
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
  },
});
