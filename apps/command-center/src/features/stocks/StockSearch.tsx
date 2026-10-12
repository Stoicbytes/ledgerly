import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { useInteractionState } from '@/hooks/useInteractionState';
import { searchSecurities, type SecurityMatch } from '@/lib/data/marketRepository';
import { formatMoney } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

/** Searches the listed shares stored from the exchange file (server side). */
export function StockSearch({ onPick }: { onPick: (match: SecurityMatch) => void }) {
  const theme = useTheme();
  const mode = useMarketStore((state) => state.mode);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SecurityMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const text = query.trim();
    if (mode !== 'cloud' || !text) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      searchSecurities(text)
        .then((found) => {
          if (!current) return;
          setMatches(found);
          setMessage(
            found.length
              ? null
              : 'No match. Enter the stock by hand below (the list fills in once prices are set up).',
          );
        })
        .catch(
          () => current && setMessage('Search is unavailable right now. Enter the stock by hand.'),
        );
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, mode]);
  if (mode !== 'cloud') {
    return (
      <Text variant="caption" color="textTertiary">
        Searching listed shares works when you are signed in. In the preview, enter a stock by hand.
      </Text>
    );
  }
  return (
    <View style={{ gap: theme.space[2] }}>
      <TextField
        label="Search listed shares"
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          if (!next.trim()) {
            setMatches([]);
            setMessage(null);
          }
        }}
        placeholder="Symbol or company, e.g. INFY"
        autoCapitalize="characters"
      />
      {message ? (
        <Text variant="caption" color="textSecondary" role="status">
          {message}
        </Text>
      ) : null}
      <View style={{ gap: theme.space[1] }}>
        {matches.map((match) => (
          <Match key={match.isin} match={match} onPress={() => onPick(match)} />
        ))}
      </View>
    </View>
  );
}

function Match({ match, onPress }: { match: SecurityMatch; onPress: () => void }) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${match.symbol}, ${match.name}`}
      onPress={onPress}
      {...handlers}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: focused ? theme.colors.accent : theme.colors.border,
        backgroundColor: hovered ? theme.colors.surfaceMuted : theme.colors.surface,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label">{match.symbol}</Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {match.name} · {match.exchange}
        </Text>
      </View>
      {match.close ? (
        <Text variant="label" color="textSecondary" numeric>
          {formatMoney(match.close)}
        </Text>
      ) : null}
    </Pressable>
  );
}
