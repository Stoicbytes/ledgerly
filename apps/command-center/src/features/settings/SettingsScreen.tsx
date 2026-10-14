import { View } from 'react-native';
import { Monitor, Moon, Sun } from '@/components/icons';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Card, CardHeader, CategoryIcon, SegmentedControl } from '@/components/ui';
import { useUiStore, type ThemePreference } from '@/state/ui';
import { useTheme, type ColorRoles } from '@/theme';
import { useSession } from '@/features/auth/sessionStore';
import { AccountCard } from './AccountCard';
import { DbUpdatesCard } from './DbUpdatesCard';
import { DeviceSignInCard } from './DeviceSignInCard';
import { ExportCard } from './ExportCard';
import { SheetImportCard } from './import/SheetImportCard';
import { ResetCard } from './reset/ResetCard';
import { ProfileCard } from './ProfileCard';
import { SecurityCard } from './SecurityCard';

const themeSegments = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export function SettingsScreen() {
  const theme = useTheme();
  const preference = useUiStore((state) => state.themePreference);
  const setPreference = useUiStore((state) => state.setThemePreference);
  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor;
  const signedIn = useSession((state) => state.status === 'signedIn');
  return (
    <Screen>
      <PageHeader title="Settings" description="Appearance, your account and this device." />
      <BentoRow>
        <BentoCell>
          <Card index={0} style={{ gap: theme.space[4] }}>
            <CardHeader
              title="Appearance"
              subtitle="This device for now · saved to your account from Phase 3"
              action={<CategoryIcon icon={Icon} tint={0} size={40} />}
            />
            <SegmentedControl
              segments={themeSegments}
              value={preference}
              onChange={setPreference}
              accessibilityLabel="Theme"
            />
            <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
              {(['primary', 'brandFrom', 'ink', 'chart'] as const).map((role, index) => (
                <View
                  key={role}
                  aria-hidden
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: theme.radius.md,
                    backgroundColor:
                      role === 'chart'
                        ? theme.colors.chart[index]
                        : (theme.colors[role as keyof ColorRoles] as string),
                  }}
                />
              ))}
            </View>
          </Card>
        </BentoCell>
        <BentoCell>
          <AccountCard index={1} />
          {signedIn ? <ProfileCard index={2} /> : null}
          {signedIn ? <SecurityCard index={2} /> : null}
          {signedIn ? <DeviceSignInCard index={3} /> : null}
          {signedIn ? <ExportCard index={4} /> : null}
          {signedIn ? <DbUpdatesCard index={4} /> : null}
          <SheetImportCard index={5} />
          <ResetCard index={6} />
        </BentoCell>
      </BentoRow>
    </Screen>
  );
}
