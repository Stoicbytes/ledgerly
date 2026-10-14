import { lazy, Suspense, useState } from 'react';
import { Download } from '@/components/icons';
import { Button } from '@/components/ui';

// The import sheet (file reading, review cards) loads only when Import is pressed.
const ImportTradebookSheet = lazy(() =>
  import('./ImportTradebookSheet').then((module) => ({ default: module.ImportTradebookSheet })),
);

export function ImportTradebookButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Import" variant="secondary" icon={Download} onPress={() => setOpen(true)} />
      {open ? (
        <Suspense fallback={null}>
          <ImportTradebookSheet onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
