import { router } from 'expo-router';
import { Compass } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Screen } from '@/components/layout/Screen';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        icon={Compass}
        title="Page not found"
        body="This address doesn’t match any page. It may have moved during the redesign."
        action={{ label: 'Go to dashboard', onPress: () => router.replace('/dashboard') }}
      />
    </Screen>
  );
}
