import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Image, Platform, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { SheetTextInput, sheetKeyboardProps } from '@/components/ui/SheetTextInput';
import { Button } from '@/components/ui/Button';
import { useLogParsedMeal, useParseMeal, type ItemSource, type ParsedItem } from '@/hooks/useSmartLog';
import { useHideTabBar } from '@/stores/uiStore';
import { notify } from '@/lib/confirm';
import { showToast } from '@/stores/toastStore';
import { loggedAtFor } from '@/lib/date';
import { MEALS, mealForHour, type Meal } from '@/lib/meals';
import { Colors } from '@/constants/colors';


/** Photos are shrunk before upload: plenty for the model, a few hundred kB. */
const PHOTO_WIDTH = 1024;

const CONFIDENCE_LABELS = { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' } as const;

type OilAnswer = 'none' | 'a_little' | 'a_lot';
const OIL_CHOICES: { value: OilAnswer; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'a_little', label: 'A little' },
  { value: 'a_lot', label: 'A lot' },
];
// About a teaspoon or a tablespoon
const OIL_GRAMS: Record<OilAnswer, number> = { none: 0, a_little: 5, a_lot: 15 };
const OIL_KEY = 'cooking-oil';

const SOURCE_LABELS: Record<ItemSource, { label: string; color: () => string }> = {
  memory: { label: 'Your usual', color: () => Colors.teal },
  database: { label: 'Food database', color: () => Colors.blue },
  estimate: { label: 'Estimate', color: () => Colors.muted },
};

/** Read during render, so it follows the current theme */
const fieldStyle = () => ({
  backgroundColor: Colors.surface2,
  borderRadius: 14,
  padding: 12,
  color: Colors.text,
  fontFamily: 'DMSans-Regular',
  fontSize: 15,
  borderWidth: 1.5,
  borderColor: Colors.border,
} as const);

interface Row extends ParsedItem {
  key: string;
  /** The grams as typed, so the field can be cleared while editing */
  gramsText: string;
}

const kcalFor = (row: Row) => Math.round((row.per100.kcal * (parseFloat(row.gramsText) || 0)) / 100);
const errorText = (err: any, fallback: string) => err?.response?.data?.message?.toString() ?? fallback;

/**
 * Log a meal by describing it (typed or dictated with the keyboard's mic) or
 * from a photo. Every item is shown with where its numbers came from and can
 * be adjusted or removed before anything is logged.
 */
export function SmartLogSheet({ date, initialMeal, onClose }: { date?: string; initialMeal?: Meal; onClose: () => void }) {
  const sheetRef = useRef<BottomSheet>(null);
  useHideTabBar();
  const { mutateAsync: parse, isPending: reading } = useParseMeal();
  const { mutateAsync: logMeal, isPending: logging } = useLogParsedMeal();

  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  // "Cooked in oil?": asked when the reading couldn't tell; null once answered
  const [oilAsked, setOilAsked] = useState(false);
  const [oil, setOil] = useState<OilAnswer | null>(null);
  const [answer, setAnswer] = useState('');
  const [meal, setMeal] = useState<Meal>(initialMeal ?? mealForHour(new Date().getHours()));

  async function addPhoto(fromCamera: boolean) {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          notify('Camera is off', 'Allow camera access for GRIT in Settings, or choose a photo instead.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const resize = !asset.width || asset.width > PHOTO_WIDTH ? [{ resize: { width: PHOTO_WIDTH } }] : [];
      const image = await manipulateAsync(asset.uri, resize, { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      if (!image.base64) throw new Error('Could not read that photo.');
      setPhoto({ uri: image.uri, base64: image.base64 });
    } catch (err: any) {
      notify("Couldn't use that photo", err?.message ?? 'Try another one.');
    }
  }

  async function read(extra?: string) {
    const description = [text.trim(), extra?.trim()].filter(Boolean).join('\n');
    if (!description && !photo) return;
    try {
      const result = await parse({
        text: description || undefined,
        imageBase64: photo?.base64,
        imageType: photo ? 'image/jpeg' : undefined,
      });
      if (!result.items.length) {
        notify('No food found', 'Try describing it in a few words, like "chicken salad and a cola".');
        return;
      }
      if (extra) setText(description);
      setAnswer('');
      setQuestion(result.question);
      setOilAsked(result.cookingFatUnclear);
      setOil(null);
      setRows(result.items.map((item, i) => ({ ...item, key: `${i}-${item.name}`, gramsText: String(item.grams) })));
    } catch (err: any) {
      notify("Couldn't read that meal", errorText(err, 'Check your connection and try again.'));
    }
  }

  async function handleLog() {
    const items = (rows ?? []).filter((r) => (parseFloat(r.gramsText) || 0) > 0);
    if (!items.length) return;
    try {
      const res = await logMeal({
        mealType: meal,
        loggedAt: date ? loggedAtFor(date) : undefined,
        items: items.map((r) => ({
          name: r.name,
          brand: r.brand ?? undefined,
          grams: Math.min(5000, parseFloat(r.gramsText)),
          kcalPer100g: r.per100.kcal,
          proteinPer100g: r.per100.protein,
          carbsPer100g: r.per100.carbs,
          fatPer100g: r.per100.fat,
          caffeinePer100g: r.per100.caffeine,
          alcoholPer100g: r.per100.alcohol,
        })),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`${res.logged} item${res.logged === 1 ? '' : 's'} added to ${meal}. GRIT will remember these portions.`, 'info');
      onClose();
    } catch (err: any) {
      notify("Couldn't log the meal", errorText(err, 'Check your connection and try again.'));
    }
  }

  const setGrams = (key: string, value: string) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, gramsText: value.replace(/[^0-9.]/g, '') } : r)) ?? null);
  const removeRow = (key: string) => setRows((rs) => rs?.filter((r) => r.key !== key) ?? null);

  /** Adds (or changes, or removes) the cooking oil row for the answer. */
  function answerOil(answer: OilAnswer) {
    setOil(answer);
    const grams = OIL_GRAMS[answer];
    setRows((rs) => {
      const rest = (rs ?? []).filter((r) => r.key !== OIL_KEY);
      if (!grams) return rest;
      return [...rest, {
        key: OIL_KEY,
        name: 'cooking oil',
        brand: null,
        portion: answer === 'a_lot' ? 'about 1 tbsp' : 'about 1 tsp',
        grams,
        gramsText: String(grams),
        per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 },
        source: 'estimate',
        confidence: 'medium',
        check: false,
        calories: 0, proteinG: 0, carbsG: 0, fatG: 0,
      }];
    });
  }

  const loggable = (rows ?? []).filter((r) => (parseFloat(r.gramsText) || 0) > 0);
  const totalKcal = loggable.reduce((t, r) => t + kcalFor(r), 0);

  const chip = (label: string, onPress: () => void, a11y: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.surface2, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' }}
    >
      <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['88%']}
      enablePanDownToClose
      onClose={onClose}
      {...sheetKeyboardProps}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.muted }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 20 }}>✨ Smart log</Text>
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
            {rows ? 'Check the portions, then log.' : 'Describe what you ate or snap a photo. You review everything before it’s logged.'}
          </Text>
        </View>

        {!rows ? (
          <>
            <SheetTextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. 2 eggs on sourdough with butter and a flat white"
              placeholderTextColor={Colors.muted}
              multiline
              maxLength={1000}
              style={{ ...fieldStyle(), minHeight: 96, textAlignVertical: 'top' }}
              accessibilityLabel="Describe your meal"
            />
            {Platform.OS !== 'web' && (
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12, marginTop: -8 }}>
                Rather say it? Tap the 🎤 on your keyboard.
              </Text>
            )}

            {photo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={{ uri: photo.uri }} style={{ width: 72, height: 72, borderRadius: 12 }} accessibilityLabel="Meal photo" />
                <Pressable onPress={() => setPhoto(null)} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ color: Colors.error, fontFamily: 'DMSans-Medium', fontSize: 14 }}>Remove photo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Platform.OS !== 'web' && chip('📷 Take photo', () => addPhoto(true), 'Take a photo of your meal')}
                {chip('🖼️ Choose photo', () => addPhoto(false), 'Choose a photo of your meal')}
              </View>
            )}

            <Button label={reading ? 'Reading your meal…' : 'Read meal'} onPress={() => read()} loading={reading} disabled={!text.trim() && !photo} />
          </>
        ) : (
          <>
            {question && (
              <View style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: `${Colors.orange}60` }}>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{question}</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <SheetTextInput
                    value={answer}
                    onChangeText={setAnswer}
                    placeholder="Your answer"
                    placeholderTextColor={Colors.muted}
                    style={{ ...fieldStyle(), flex: 1, paddingVertical: 10 }}
                    accessibilityLabel="Answer the question"
                  />
                  <Pressable
                    onPress={() => read(answer)}
                    disabled={!answer.trim() || reading}
                    accessibilityRole="button"
                    style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: answer.trim() ? Colors.orange : Colors.border }}
                  >
                    {reading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontFamily: 'DMSans-Bold', fontSize: 14 }}>Update</Text>}
                  </Pressable>
                </View>
              </View>
            )}

            {oilAsked && (
              <View style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: `${Colors.orange}60` }}>
                <Text style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>Cooked in oil or butter?</Text>
                <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
                  {OIL_CHOICES.map((c) => {
                    const selected = oil === c.value;
                    return (
                      <Pressable
                        key={c.value}
                        onPress={() => answerOil(c.value)}
                        accessibilityRole="radio"
                        aria-checked={selected}
                        style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: selected ? Colors.orange : Colors.surface, borderWidth: 1, borderColor: selected ? Colors.orange : Colors.border }}
                      >
                        <Text style={{ color: selected ? '#fff' : Colors.text, fontFamily: 'DMSans-Medium', fontSize: 13 }}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ gap: 10 }}>
              {rows.map((row) => {
                const src = SOURCE_LABELS[row.source];
                return (
                  <View key={row.key} style={{ backgroundColor: Colors.surface2, borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, borderColor: Colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15, textTransform: 'capitalize' }}>
                          {row.brand ? `${row.brand} ` : ''}{row.name}
                        </Text>
                        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>{row.portion}</Text>
                      </View>
                      <Pressable onPress={() => removeRow(row.key)} accessibilityRole="button" accessibilityLabel={`Remove ${row.name}`} hitSlop={10}>
                        <Text style={{ color: Colors.muted, fontSize: 16 }}>✕</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <SheetTextInput
                        value={row.gramsText}
                        onChangeText={(t) => setGrams(row.key, t)}
                        keyboardType="decimal-pad"
                        style={{ ...fieldStyle(), width: 84, paddingVertical: 8, fontFamily: 'JetBrainsMono-Regular' }}
                        accessibilityLabel={`Grams of ${row.name}`}
                      />
                      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>g</Text>
                      <Text style={{ flex: 1, color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 15, textAlign: 'right' }}>
                        {kcalFor(row)} kcal
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} accessibilityLabel={`${src.label}, ${row.confidence} confidence${row.check ? ', check this' : ''}`}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: src.color() }} />
                      <Text style={{ color: src.color(), fontFamily: 'DMSans-Medium', fontSize: 11 }}>{src.label}</Text>
                      <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 11 }}>· {CONFIDENCE_LABELS[row.confidence]}</Text>
                      {row.check && (
                        <Text style={{ color: Colors.error, fontFamily: 'DMSans-Bold', fontSize: 11 }}>· ⚠ check this</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 14 }}>Total</Text>
              <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 20 }} accessibilityLabel={`Total ${totalKcal} calories`}>
                {totalKcal} kcal
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {MEALS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMeal(m)}
                  accessibilityRole="radio"
                  aria-selected={meal === m}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: meal === m ? Colors.orange : Colors.surface2, borderWidth: 1, borderColor: meal === m ? Colors.orange : Colors.border }}
                >
                  <Text style={{ color: meal === m ? '#fff' : Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 13, textTransform: 'capitalize' }}>{m}</Text>
                </Pressable>
              ))}
            </View>

            <Button
              label={loggable.length ? `Log ${loggable.length} item${loggable.length === 1 ? '' : 's'}` : 'Nothing to log'}
              onPress={handleLog}
              loading={logging}
              disabled={!loggable.length}
            />
            <Pressable onPress={() => { setRows(null); setQuestion(null); setOilAsked(false); setOil(null); }} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Medium', fontSize: 14 }}>Start over</Text>
            </Pressable>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
