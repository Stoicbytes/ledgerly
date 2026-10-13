import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { ChevronLeft, ChevronRight, Download } from '@/components/icons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import {
  Button,
  Card,
  CardHeader,
  IconButton,
  ProgressBar,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { changeText, reportPdf, reportSections } from '@/lib/domain/reports';
import { canSaveBytes, saveBytes } from '@/lib/files/saveBytes';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { useReport } from './useReport';

const KINDS = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'fy', label: 'Financial year' },
] as const;

/** Dashboard → Reports: a period's money in one place, with a PDF to keep or share. */
export function ReportsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { report, kind, setKind, previous, next, isLatest, today } = useReport();
  const download = async () => {
    try {
      const name = `ledgerly-report-${report.period.label.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      await saveBytes(reportPdf(report, today), name, 'application/pdf');
    } catch {
      toast.show({ message: 'The report could not be saved. Try again.' });
    }
  };
  const sections = reportSections(report);
  const tiles = [
    { label: 'Income', value: money(report.income), note: changeText(report.incomeChange) },
    { label: 'Spending', value: money(report.expense), note: changeText(report.expenseChange) },
    { label: 'Saved', value: money(report.net), note: '' },
    {
      label: 'Savings rate',
      value: report.savingsRate === null ? '–' : `${Math.round(report.savingsRate)}%`,
      note: '',
    },
  ];
  return (
    <Screen>
      <PageHeader
        title="Reports"
        description="Income, spending, investments, salary and PF for a period."
        meta={<SampleDataBadge />}
        actions={
          canSaveBytes ? (
            <Button
              label="Download PDF"
              icon={Download}
              variant="secondary"
              onPress={() => void download()}
            />
          ) : null
        }
      />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: theme.space[3],
        }}
      >
        <SegmentedControl
          segments={KINDS}
          value={kind}
          onChange={setKind}
          accessibilityLabel="Report period"
          fill={false}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <IconButton
            icon={ChevronLeft}
            variant="surface"
            accessibilityLabel="Earlier period"
            onPress={previous}
          />
          <Text variant="title">{report.period.label}</Text>
          <IconButton
            icon={ChevronRight}
            variant="surface"
            accessibilityLabel="Later period"
            onPress={next}
            disabled={isLatest}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
        {tiles.map((tile, index) => (
          <Card
            key={tile.label}
            index={index}
            style={{ flexGrow: 1, flexBasis: 160, gap: theme.space[1] }}
          >
            <Text variant="label" color="textSecondary">
              {tile.label}
            </Text>
            <Text variant="figureSm" numeric>
              {tile.value}
            </Text>
            {tile.note ? (
              <Text
                variant="caption"
                color="textSecondary"
              >{`${tile.note} on the period before`}</Text>
            ) : null}
          </Card>
        ))}
      </View>
      {report.spending.length ? (
        <Card style={{ gap: theme.space[3] }}>
          <CardHeader
            title="Spending by category"
            subtitle="Your share of each expense; change on the period before."
          />
          {report.spending.map((line) => (
            <View key={line.name} style={{ gap: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.space[2],
                }}
              >
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {line.name}
                </Text>
                <Text
                  numeric
                >{`${money(line.amount)}${line.change === null ? '' : `  ${changeText(line.change)}`}`}</Text>
              </View>
              <ProgressBar
                value={line.share}
                height={6}
                accessibilityLabel={`${line.name} ${Math.round(line.share * 100)}%`}
              />
            </View>
          ))}
        </Card>
      ) : null}
      {sections
        .filter((section) => !['Summary', 'Spending by category'].includes(section.title))
        .map((section) => (
          <Card key={section.title} style={{ gap: theme.space[2] }}>
            <CardHeader title={section.title} />
            {section.rows.map((row) => (
              <View
                key={row.left}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.space[3],
                }}
              >
                <Text variant={row.bold ? 'bodyStrong' : 'body'} style={{ flex: 1 }}>
                  {row.left}
                </Text>
                <Text
                  variant={row.bold ? 'bodyStrong' : 'body'}
                  numeric
                  style={{ textAlign: 'right' }}
                >
                  {row.right}
                </Text>
              </View>
            ))}
          </Card>
        ))}
      {!report.income && !report.expense && !report.spending.length ? (
        <Card>
          <Text color="textSecondary">Nothing recorded in {report.period.label}.</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
