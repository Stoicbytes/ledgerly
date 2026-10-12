import { View } from 'react-native';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { Repeat } from '@/components/icons';
import { Badge, Button, Card, CardHeader, Money, Text } from '@/components/ui';
import { dayLabel } from '@/lib/domain/expenses';
import { daysBetween, sipAmountOn, type Fund, type UpcomingSip } from '@/lib/domain/investments';
import { useTheme } from '@/theme';

/** Instalments due but not recorded yet (with "Record"), then the next month's SIPs. */
export function SipCard({
  funds,
  pending,
  upcoming,
  today,
  onRecord,
  style,
}: {
  funds: Fund[];
  pending: UpcomingSip[];
  upcoming: UpcomingSip[];
  today: string;
  onRecord: (item: UpcomingSip) => void;
  style?: object;
}) {
  const theme = useTheme();
  const name = (fundId: string) => funds.find((fund) => fund.id === fundId)?.name ?? 'Fund';
  const row = (item: UpcomingSip, due: boolean) => {
    const days = daysBetween(today, item.date);
    return (
      <View
        key={`${item.sip.id}-${item.date}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          padding: theme.space[3],
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" numberOfLines={1}>
            {name(item.sip.fundId)}
          </Text>
          <Text variant="caption" color="textSecondary">
            {dayLabel(item.date, 'short')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Money value={sipAmountOn(item.sip, item.date)} variant="label" />
          {due ? (
            <Button label="Record" size="sm" onPress={() => onRecord(item)} />
          ) : (
            <Badge
              label={days <= 0 ? 'Today' : `in ${days}d`}
              tone={days <= 3 ? 'warning' : 'neutral'}
            />
          )}
        </View>
      </View>
    );
  };
  return (
    <Card index={8} padding={4} style={[{ gap: theme.space[2] }, style]}>
      <View style={{ paddingHorizontal: theme.space[1] }}>
        <CardHeader
          title="SIPs"
          subtitle={
            pending.length ? `${pending.length} to record` : `${upcoming.length} in the next month`
          }
          action={<Repeat size={18} color={theme.colors.textSecondary} />}
        />
      </View>
      <PanelScroll gap={theme.space[2]}>
        {pending.map((item) => row(item, true))}
        {upcoming.map((item) => row(item, false))}
        {!pending.length && !upcoming.length ? (
          <Text variant="caption" color="textTertiary" style={{ padding: theme.space[2] }}>
            No SIPs due. Add a SIP plan from the fund details.
          </Text>
        ) : null}
      </PanelScroll>
    </Card>
  );
}
