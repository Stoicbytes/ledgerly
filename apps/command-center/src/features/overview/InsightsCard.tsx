import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight, CircleAlert, CircleCheck, Lightbulb } from '@/components/icons';
import { Button, Card, CardHeader, Text } from '@/components/ui';
import { monthOf, todayIso } from '@/lib/domain/expenses';
import { monthName } from '@/lib/domain/insights';
import { useTheme } from '@/theme';
import type { Insight, MonthPulse } from './insights';
import { PulsePanel } from './PulsePanel';

const EXPENSES = '/dashboard/expenses';
const STATS = '/dashboard/expenses/stats';
const SALARY = '/dashboard/salary';

/** Where each insight is acted on. */
const LINKS: Record<string, { href: string; label: string }> = {
  budget: { href: '/dashboard/expenses/budget', label: 'Budget' },
  cards: { href: '/dashboard/accounts', label: 'Accounts' },
  pace: { href: STATS, label: 'Stats' },
  category: { href: STATS, label: 'Stats' },
  recurring: { href: EXPENSES, label: 'Expenses' },
  largest: { href: EXPENSES, label: 'Expenses' },
  'payslip-missing': { href: SALARY, label: 'Salary & PF' },
  'salary-change': { href: SALARY, label: 'Salary & PF' },
  tds: { href: SALARY, label: 'Salary & PF' },
  salary: { href: SALARY, label: 'Salary & PF' },
  'pf-interest': { href: SALARY, label: 'Salary & PF' },
  'pf-employer': { href: SALARY, label: 'Salary & PF' },
  'pf-growth': { href: SALARY, label: 'Salary & PF' },
};

/** Good-to-know lines shown before "Show more". */
const FOLDED = 3;

/**
 * "This month" on the home screen: three headline numbers (income kept, where spending is
 * heading, how long cash lasts), then what needs a look and what is good to know. Each line
 * opens the page where it is acted on. Hidden when there is nothing to show.
 */
export function InsightsCard({ insights, pulse }: { insights: Insight[]; pulse: MonthPulse }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const empty =
    !insights.length && pulse.savingsRate === null && !pulse.projection && !pulse.runway;
  if (empty) return null;
  const attention = insights.filter((item) => item.tone === 'warn');
  const notes = insights.filter((item) => item.tone !== 'warn');
  const shown = open ? notes : notes.slice(0, FOLDED);
  const month = monthName(monthOf(todayIso()));
  return (
    <Card style={{ gap: theme.space[4] }}>
      <CardHeader
        title="This month"
        subtitle={`${pulse.daysLeft} ${pulse.daysLeft === 1 ? 'day' : 'days'} left in ${month} · from your own entries`}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[4] }}>
        <PulsePanel pulse={pulse} />
        <View style={{ flexBasis: 340, flexGrow: 2, gap: theme.space[4] }}>
          <View style={{ gap: theme.space[2] }}>
            <Text variant="eyebrow" color="textSecondary">
              NEEDS A LOOK
            </Text>
            {attention.length ? (
              attention.map((item) => <InsightRow key={item.id} item={item} />)
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
                <CircleCheck size={16} color={theme.colors.success} />
                <Text color="textSecondary">Nothing needs a look right now.</Text>
              </View>
            )}
          </View>
          {notes.length ? (
            <View style={{ gap: theme.space[2] }}>
              <Text variant="eyebrow" color="textSecondary">
                GOOD TO KNOW
              </Text>
              {shown.map((item) => (
                <InsightRow key={item.id} item={item} />
              ))}
              {notes.length > FOLDED ? (
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    label={open ? 'Show less' : `Show ${notes.length - FOLDED} more`}
                    variant="ghost"
                    size="sm"
                    onPress={() => setOpen(!open)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** One insight; opens the page where it is acted on. */
function InsightRow({ item }: { item: Insight }) {
  const theme = useTheme();
  const link = LINKS[item.id];
  const Icon = { warn: CircleAlert, good: CircleCheck, info: Lightbulb }[item.tone];
  const color = {
    warn: theme.colors.warning,
    good: theme.colors.success,
    info: theme.colors.info,
  }[item.tone];
  const body = (
    <>
      <Icon size={18} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{item.title}</Text>
        <Text variant="caption" color="textSecondary">
          {item.detail}
        </Text>
      </View>
      {link ? <ChevronRight size={16} color={theme.colors.textSecondary} /> : null}
    </>
  );
  const style = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: color,
    backgroundColor: theme.colors.surfaceMuted,
  } as const;
  if (!link) {
    return (
      <View accessibilityLabel={`${item.title}. ${item.detail}`} style={style}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      role="link"
      accessibilityLabel={`${item.title}. ${item.detail} Open ${link.label}.`}
      onPress={() => router.push(link.href as Href)}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        style,
        (hovered || pressed) && { backgroundColor: theme.colors.border },
      ]}
    >
      {body}
    </Pressable>
  );
}
