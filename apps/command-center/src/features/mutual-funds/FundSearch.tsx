import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { useInteractionState } from '@/hooks/useInteractionState';
import { searchFunds, type FundMatch } from '@/lib/data/marketRepository';
import { fundCategoryLabel } from '@/lib/domain/investments';
import { useTheme } from '@/theme';

/** Searches the AMFI scheme list (server side) and returns the scheme picked. */
export function FundSearch({
  onPick,
  initialQuery = '',
  noMatchText = 'No match. Check the spelling, or enter the fund by hand below (the fund list fills in once prices are set up).',
}: {
  onPick: (match: FundMatch) => void;
  /** Search shown on open (for example "nifty 50 index"). */
  initialQuery?: string;
  noMatchText?: string;
}) {
  const theme = useTheme();
  const mode = useMarketStore((state) => state.mode);
  const [query, setQuery] = useState(initialQuery);
  const [matches, setMatches] = useState<FundMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const text = query.trim();
    if (mode !== 'cloud' || text.length < 3) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      searchFunds(text)
        .then((found) => {
          if (!current) return;
          setMatches(found);
          setMessage(found.length ? null : noMatchText);
        })
        .catch(
          () => current && setMessage('Search is unavailable right now. Enter the fund by hand.'),
        );
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, mode, noMatchText]);
  if (mode !== 'cloud') {
    return (
      <Text variant="caption" color="textTertiary">
        Searching the AMFI fund list works when you are signed in. In the preview, enter a fund by
        hand.
      </Text>
    );
  }
  return (
    <View style={{ gap: theme.space[2] }}>
      <TextField
        label="Search AMFI funds"
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          if (next.trim().length < 3) {
            setMatches([]);
            setMessage(null);
          }
        }}
        placeholder="e.g. parag flexi direct growth"
        autoCapitalize="none"
        hint="Type at least 3 letters of the scheme name, or its AMFI code."
      />
      {message ? (
        <Text variant="caption" color="textSecondary" role="status">
          {message}
        </Text>
      ) : null}
      <View style={{ gap: theme.space[1] }}>
        {matches.map((match) => (
          <Match key={match.schemeCode} match={match} onPress={() => onPick(match)} />
        ))}
      </View>
    </View>
  );
}

function Match({ match, onPress }: { match: FundMatch; onPress: () => void }) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${match.name}, ${match.fundHouse}`}
      onPress={onPress}
      {...handlers}
      style={{
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: focused ? theme.colors.accent : theme.colors.border,
        backgroundColor: hovered ? theme.colors.surfaceMuted : theme.colors.surface,
        gap: 2,
      }}
    >
      <Text variant="label" numberOfLines={2}>
        {match.name}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {[match.fundHouse, fundCategoryLabel(match.category), `code ${match.schemeCode}`]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </Pressable>
  );
}
