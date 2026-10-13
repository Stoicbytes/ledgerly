import { useState } from 'react';
import { Platform } from 'react-native';
import { Download } from '@/components/icons';
import { Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { snapshot } from '@/features/sync/stores';
import { loadSite } from '@/lib/data/siteRepository';
import { saveTextFile } from '@/lib/files/saveTextFile';
import { useTheme } from '@/theme';
import { buildExport, exportFileName } from './exportAll';

/** Saves everything you keep in the app as one JSON file. */
export function ExportCard({ index }: { index: number }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setNotice(null);
    try {
      // The portfolio site is loaded separately; the rest of the export works without it.
      const site = await loadSite().catch(() => null);
      const file = buildExport(snapshot(), site);
      await saveTextFile(JSON.stringify(file, null, 2), exportFileName(), 'application/json');
      setNotice(
        site
          ? 'Export ready. Keep it somewhere private: it holds all your financial data.'
          : 'Export ready, without the portfolio site (it could not be loaded). Keep it private.',
      );
    } catch {
      setNotice('The export could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card index={index} style={{ gap: theme.space[4] }}>
      <CardHeader
        title="Export everything"
        subtitle="One JSON file: entries, notes, funds, shares, salary, PF and your portfolio site."
        action={<CategoryIcon icon={Download} tint={5} size={40} />}
      />
      <Button
        label={Platform.OS === 'web' ? 'Download export' : 'Share export'}
        icon={Download}
        variant="secondary"
        loading={busy}
        onPress={() => void run()}
      />
      {notice ? (
        <Text variant="caption" color="textSecondary">
          {notice}
        </Text>
      ) : null}
    </Card>
  );
}
