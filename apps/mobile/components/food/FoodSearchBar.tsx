import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { MIN_SEARCH_LENGTH, useFoodSearch, type NormalizedFood } from '@/hooks/useFoodLog';
import { recordSearch } from '@/lib/searchEvents';
import { searchServing } from '@/lib/servings';
import { VerifiedPill } from '@/components/food/VerifiedPill';
import { Colors } from '@/constants/colors';

/** Wait this long after the last keystroke before searching */
const DEBOUNCE_MS = 250;

interface FoodSearchBarProps {
  onSelect: (food: NormalizedFood) => void;
}

export function FoodSearchBar({ onSelect }: FoodSearchBarProps) {
  const [query, setQuery] = useState('');
  const term = query.trim();
  const [searched, setSearched] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setSearched(term), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);
  const { data: results, isLoading } = useFoodSearch(searched);
  const active = term.length >= MIN_SEARCH_LENGTH && searched.length >= MIN_SEARCH_LENGTH;

  // A search the user leaves without picking anything counts as a miss
  const pending = useRef('');
  pending.current = query;
  // What the list shows, for the search events
  const shown = useRef<{ term: string; count?: number }>({ term: '' });
  shown.current = { term: searched, count: searched === term ? results?.length : undefined };
  useEffect(() => () => recordSearch(pending.current, undefined, shown.current.count), []);
  const clear = () => {
    recordSearch(query, undefined, shown.current.count);
    setQuery('');
  };

  const renderItem = useCallback(
    ({ item, index }: { item: NormalizedFood; index: number }) => {
      const { serving, kcal } = searchServing(item);
      const sub = [item.brand, serving].filter(Boolean).join(' · ');
      return (
        <Pressable accessibilityRole="button"
          accessibilityLabel={[
            item.name,
            item.brand,
            item.verified ? 'verified' : null,
            serving ? `${serving}, ${kcal} kcal` : `${kcal} kcal per 100 g`,
          ].filter(Boolean).join(', ')}
          onPress={() => {
            recordSearch(shown.current.term, { position: index, name: item.name, foodId: item.foodId }, shown.current.count);
            pending.current = '';
            onSelect(item);
            setQuery('');
          }}
          style={({ pressed }) => ({
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: pressed ? Colors.surface2 : 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  flexShrink: 1,
                  color: Colors.text,
                  fontFamily: 'DMSans-Medium',
                  fontSize: 15,
                }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.verified === true && <VerifiedPill />}
            </View>
            {!!sub && (
              <Text
                style={{
                  color: Colors.muted,
                  fontFamily: 'DMSans-Regular',
                  fontSize: 12,
                }}
                numberOfLines={1}
              >
                {sub}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text
              style={{
                color: serving ? Colors.text : Colors.muted,
                fontFamily: 'JetBrainsMono-Regular',
                fontSize: 13,
              }}
            >
              {kcal} kcal
            </Text>
            {!serving && (
              <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular', fontSize: 10 }}>per 100 g</Text>
            )}
          </View>
        </Pressable>
      );
    },
    [onSelect],
  );

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: Colors.surface2,
          borderRadius: 16,
          paddingHorizontal: 14,
          height: 48,
          borderWidth: 1.5,
          borderColor: Colors.border,
          gap: 8,
        }}
      >
        <Text style={{ color: Colors.muted, fontSize: 16 }}>🔍</Text>
        <TextInput
          style={{
            flex: 1,
            color: Colors.text,
            fontFamily: 'DMSans-Regular',
            fontSize: 15,
          }}
          placeholder="Search foods..."
          placeholderTextColor={Colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {isLoading && <ActivityIndicator size="small" color={Colors.muted} />}
        {query.length > 0 && !isLoading && (
          <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={clear} hitSlop={8}>
            <Text style={{ color: Colors.muted, fontSize: 16 }}>×</Text>
          </Pressable>
        )}
      </View>

      {active && results && results.length > 0 && (
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            marginTop: 6,
            maxHeight: 300,
            overflow: 'hidden',
          }}
        >
          <FlatList
            data={results}
            keyExtractor={(item, i) => `${item.foodId ?? item.offId}-${i}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {active && !isLoading && results?.length === 0 && (
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            marginTop: 6,
            padding: 16,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ color: Colors.muted, fontFamily: 'DMSans-Regular' }}>
            No results for "{query}"
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Log "${term}" manually`} onPress={() => { recordSearch(query, undefined, 0); pending.current = ''; onSelect({ offId: '', name: query, brand: null, barcode: null, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, servingQty: 1, servingUnit: 'serving', imageUrl: null }); }}>
            <Text style={{ color: Colors.orange, fontFamily: 'DMSans-Bold' }}>
              Log "{query}" manually →
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
