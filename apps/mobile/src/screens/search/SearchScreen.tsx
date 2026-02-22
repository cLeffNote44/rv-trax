import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SearchStackParamList } from '@/navigation/types';
import type { Unit } from '@rv-trax/shared';
import { useUnitStore } from '@/stores/useUnitStore';
import { SearchResultItem } from './components/SearchResultItem';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type SearchNav = NativeStackNavigationProp<SearchStackParamList>;

// Simple in-memory recent searches (MMKV would be used in production)
let recentSearchesCache: string[] = [];

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<SearchNav>();
  const units = useUnitStore((s) => s.units);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(recentSearchesCache);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const q = query.trim().toLowerCase();

        // Client-side filter across stock_number, vin, make, model, floorplan
        const filtered = units.filter((u) => {
          return (
            u.stock_number.toLowerCase().includes(q) ||
            (u.vin && u.vin.toLowerCase().includes(q)) ||
            u.make.toLowerCase().includes(q) ||
            u.model.toLowerCase().includes(q) ||
            (u.floorplan && u.floorplan.toLowerCase().includes(q))
          );
        });

        setResults(filtered);
        setHasSearched(true);
      } catch {
        setResults([]);
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, units]);

  const addRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== term);
      const updated = [term, ...filtered].slice(0, 10);
      recentSearchesCache = updated;
      return updated;
    });
  }, []);

  const handleResultPress = useCallback(
    (unit: Unit) => {
      if (query.trim()) addRecentSearch(query.trim());
      navigation.navigate('UnitDetail', { unitId: unit.id });
    },
    [navigation, query, addRecentSearch],
  );

  const handleRecentPress = useCallback((term: string) => {
    setQuery(term);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Unit }) => (
      <SearchResultItem unit={item} onPress={handleResultPress} />
    ),
    [handleResultPress],
  );

  const keyExtractor = useCallback((item: Unit) => item.id, []);

  const showRecents = !query.trim() && recentSearches.length > 0;
  const showEmpty = hasSearched && results.length === 0 && !loading;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>&#x1F50D;</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Stock #, VIN, make, model..."
            placeholderTextColor={colors.gray400}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearText}>X</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading spinner */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Recent searches */}
      {showRecents && (
        <View style={styles.recentsSection}>
          <Text style={styles.recentsTitle}>Recent Searches</Text>
          {recentSearches.map((term, index) => (
            <TouchableOpacity
              key={`${term}-${index}`}
              style={styles.recentItem}
              onPress={() => handleRecentPress(term)}
            >
              <Text style={styles.recentIcon}>&#x1F552;</Text>
              <Text style={styles.recentText}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty state */}
      {showEmpty && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search term or check the spelling.
          </Text>
        </View>
      )}

      {/* Results list */}
      {!loading && results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchBarContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 8 : spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
    paddingVertical: 0,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray400,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray500,
  },
  recentsSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  recentsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  recentText: {
    fontSize: 15,
    color: colors.gray700,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
});
