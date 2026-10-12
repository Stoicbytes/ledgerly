import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { navOnDate } from '@/lib/data/marketRepository';
import { dayLabel, isValidIsoDate } from '@/lib/domain/expenses';
import type { Series } from '@/lib/domain/investments';
import { useTheme } from '@/theme';

/**
 * The NAV field. For a fund picked from the AMFI list it can fill in the NAV published
 * on the chosen date (from stored history; the last one before it on holidays).
 */
export function NavLookup({
  schemeCode,
  date,
  value,
  onChange,
  error,
}: {
  schemeCode: number | null;
  date: string;
  value: string;
  onChange: (nav: string) => void;
  error?: string;
}) {
  const theme = useTheme();
  const mode = useMarketStore((state) => state.mode);
  const market = useMarketStore((state) => state.market);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lookUp = async () => {
    if (!schemeCode || !isValidIsoDate(date)) return;
    setBusy(true);
    try {
      const found =
        mode === 'preview'
          ? sampleNavOn(market.navHistory[String(schemeCode)], date)
          : await navOnDate(schemeCode, date);
      if (found) {
        onChange(String(found.nav));
        const source = mode === 'preview' ? 'Sample NAV' : 'AMFI NAV';
        setStatus(`${source} of ${dayLabel(found.date, 'short')}.`);
      } else {
        setStatus('No stored NAV for that date yet. Type it from your statement.');
      }
    } catch {
      setStatus('The NAV could not be looked up. Type it from your statement.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: theme.space[2] }}>
      <TextField
        label="NAV (₹ per unit)"
        inputMode="decimal"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={(next) => {
          setStatus(null);
          onChange(next);
        }}
        placeholder="58.1234"
        error={error}
      />
      {schemeCode ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Button
            label={busy ? 'Looking up…' : 'Use AMFI NAV for this date'}
            variant="secondary"
            size="sm"
            disabled={busy}
            onPress={() => void lookUp()}
          />
          {status ? (
            <Text variant="caption" color="textSecondary" style={{ flex: 1 }} role="status">
              {status}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Preview only: the sample NAV on or before a date (as the server's nav_on does). */
function sampleNavOn(points: Series | undefined, date: string) {
  const point = [...(points ?? [])].reverse().find(([day]) => day <= date);
  return point ? { nav: point[1], date: point[0] } : null;
}
