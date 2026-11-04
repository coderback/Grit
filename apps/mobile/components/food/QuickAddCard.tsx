import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import {
  portionLabel, useFavoriteFoods, useRecentFoods, useRemoveFavorite, useSaveFavorite,
  type QuickFood,
} from '@/hooks/useQuickFoods';

type Tab = 'recent' | 'favorites';
const PREVIEW = 4;

function Row({ food, starred, onLog, onStar }: { food: QuickFood; starred: boolean; onLog: () => void; onStar: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={onLog}
        accessibilityRole="button"
        accessibilityLabel={`Log ${food.name}, ${Math.round(food.calories)} calories`}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 })}
      >
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: Colors.text, fontFamily: 'DMSans-Medium', fontSize: 14 }}>{food.name}</Text>
          <Text numberOfLines={1} style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 12 }}>
            {[food.brand, portionLabel(food)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text style={{ color: Colors.text, fontFamily: 'JetBrainsMono-Regular', fontSize: 13 }}>{Math.round(food.calories)}</Text>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${Colors.orange}20`, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 16, marginTop: -1 }}>+</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onStar}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={starred ? `Remove ${food.name} from favourites` : `Save ${food.name} to favourites`}
        aria-checked={starred}
      >
        <Text style={{ fontSize: 18, color: starred ? Colors.orange : Colors.muted }}>{starred ? '★' : '☆'}</Text>
      </Pressable>
    </View>
  );
}

/** Foods eaten lately and saved favourites, logged again in a tap or two. */
export function QuickAddCard({ onPick }: { onPick: (food: QuickFood, meal?: string) => void }) {
  const [tab, setTab] = useState<Tab>('recent');
  const [showAll, setShowAll] = useState(false);
  const recent = useRecentFoods();
  const favorites = useFavoriteFoods();
  const { mutate: save } = useSaveFavorite();
  const { mutate: remove } = useRemoveFavorite();

  const recentList = recent.data ?? [];
  const favoriteList = favorites.data ?? [];
  // Nothing to offer yet: stay out of the way
  if (!recent.isLoading && !favorites.isLoading && recentList.length === 0 && favoriteList.length === 0) return null;

  const query = tab === 'recent' ? recent : favorites;
  const items = tab === 'recent' ? recentList : favoriteList;
  const shown = showAll ? items : items.slice(0, PREVIEW);

  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12, marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.text, fontFamily: 'DMSans-Bold', fontSize: 15 }}>Quick add</Text>
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="tablist">
          {(['recent', 'favorites'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setShowAll(false); }}
              accessibilityRole="tab"
              aria-selected={tab === t}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: tab === t ? Colors.surface3 : 'transparent' }}
            >
              <Text style={{ color: tab === t ? Colors.text : Colors.muted, fontFamily: 'DMSans-Bold', fontSize: 12 }}>
                {t === 'recent' ? 'Recent' : `Favourites${favoriteList.length ? ` (${favoriteList.length})` : ''}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={Colors.orange} />
      ) : items.length === 0 ? (
        <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 13 }}>
          {tab === 'favorites' ? 'Tap ☆ on a food to save it here.' : 'Foods you log will show up here.'}
        </Text>
      ) : (
        shown.map((f) => {
          const favoriteId = 'favoriteId' in f ? f.favoriteId : 'id' in f ? f.id : null;
          return (
            <Row
              key={f.key}
              food={f}
              starred={!!favoriteId}
              onLog={() => {
                Haptics.selectionAsync();
                onPick(f, 'lastMealType' in f ? f.lastMealType : undefined);
              }}
              onStar={() => (favoriteId ? remove(favoriteId) : save(f))}
            />
          );
        })
      )}

      {items.length > PREVIEW && (
        <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button" style={{ alignItems: 'center' }}>
          <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold', fontSize: 13 }}>
            {showAll ? 'Show less' : `Show all ${items.length}`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
