import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Badge } from '@/components/ui';
import { ThemeToggle } from '@/features/shell/ThemeToggle';
import { ActionsSection } from './ActionsSection';
import { ColorsSection } from './ColorsSection';
import { DataSection } from './DataSection';
import { FeedbackSection } from './FeedbackSection';
import { TypographySection } from './TypographySection';

/** Development-only catalogue of design-system components (all values are samples). */
export function ComponentGallery() {
  return (
    <Screen>
      <PageHeader
        eyebrow="Development only"
        title="Component gallery"
        description="Every Phase 1 component in its states. Values shown are fixed samples, not your data."
        actions={
          <>
            <Badge label="Sample data" tone="info" />
            <ThemeToggle />
          </>
        }
      />
      <TypographySection />
      <ColorsSection />
      <ActionsSection />
      <DataSection />
      <FeedbackSection />
    </Screen>
  );
}
