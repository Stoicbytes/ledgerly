import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '@/components/feedback';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { ScrollRow } from '@/components/ui';
import { useSession } from '@/features/auth/sessionStore';
import { PickChip } from '@/features/expenses/entry/PickChip';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { useTheme } from '@/theme';
import { ItemList } from './components/ItemList';
import { MessagesPanel } from './components/MessagesPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { PublishBar } from './components/PublishBar';
import { SkillsPanel } from './components/SkillsPanel';
import { useSiteStore } from './state/siteStore';

const TABS = [
  ['profile', 'Profile'],
  ['projects', 'Projects'],
  ['skills', 'Skills'],
  ['experience', 'Experience'],
  ['credentials', 'Education'],
  ['more', 'More'],
  ['messages', 'Messages'],
] as const;
type Tab = (typeof TABS)[number][0];

function Panel({ tab }: { tab: Tab }) {
  const theme = useTheme();
  switch (tab) {
    case 'profile':
      return (
        <View style={{ gap: theme.space[4] }}>
          <ProfilePanel />
          <ItemList
            kind="link"
            title="Links"
            addLabel="Add link"
            empty="Add GitHub, LinkedIn or any other profile."
          />
        </View>
      );
    case 'projects':
      return (
        <ItemList
          kind="project"
          title="Projects"
          addLabel="Add project"
          empty="No projects yet. Featured ones become large case studies."
        />
      );
    case 'skills':
      return <SkillsPanel />;
    case 'experience':
      return (
        <ItemList kind="experience" title="Experience" addLabel="Add role" empty="No roles yet." />
      );
    case 'credentials':
      return (
        <ItemList
          kind="education"
          title="Education and certifications"
          addLabel="Add"
          empty="Add a degree, certification, course or award."
        />
      );
    case 'more':
      return (
        <View style={{ gap: theme.space[4] }}>
          <ItemList
            kind="fact"
            title="Numbers and highlights"
            addLabel="Add"
            empty="Numbers count up in the hero; highlights and milestones appear in About."
          />
          <ItemList
            kind="section"
            title="Beyond the code"
            addLabel="Add section"
            empty="Interests, writing or experiments (optional)."
          />
        </View>
      );
    case 'messages':
      return <MessagesPanel />;
  }
}

/** Dashboard → Portfolio: edit the public site's content, preview it and publish it. */
export function PortfolioSiteScreen() {
  const theme = useTheme();
  const session = useSession((state) => state.status);
  const { status, mode, start, messages } = useSiteStore();
  const [tab, setTab] = useState<Tab>('profile');
  const unread = messages.filter((message) => !message.readAt).length;

  useEffect(() => {
    if (session === 'signedIn') void start('cloud');
    else if (session === 'preview') void start('preview');
  }, [session, start]);

  return (
    <Screen>
      <PageHeader
        title="Portfolio"
        description="Your public developer site: edit, preview, publish."
        meta={mode === 'preview' ? <SampleDataBadge editable /> : undefined}
        size="compact"
      />
      {status === 'failed' ? (
        <ErrorState
          title="Your portfolio could not be loaded"
          onRetry={() => void start('cloud')}
        />
      ) : status !== 'ready' ? (
        <View style={{ padding: theme.space[6], alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Loading" />
        </View>
      ) : (
        <View style={{ gap: theme.space[4] }}>
          <PublishBar />
          <ScrollRow accessibilityLabel="Portfolio sections" background={theme.colors.bg}>
            {TABS.map(([key, label]) => (
              <PickChip
                key={key}
                label={key === 'messages' && unread ? `${label} (${unread})` : label}
                selected={tab === key}
                onPress={() => setTab(key)}
              />
            ))}
          </ScrollRow>
          <Panel tab={tab} />
        </View>
      )}
    </Screen>
  );
}
