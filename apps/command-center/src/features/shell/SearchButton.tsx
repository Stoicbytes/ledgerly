import { Search } from '@/components/icons';
import { IconButton } from '@/components/ui';
import { useSearchStore } from '@/features/expenses/state/searchStore';

/** Opens Search everything from any screen. */
export function SearchButton() {
  const show = useSearchStore((state) => state.show);
  return (
    <IconButton
      icon={Search}
      variant="surface"
      accessibilityLabel="Search everything"
      onPress={show}
    />
  );
}
