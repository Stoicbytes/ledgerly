import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Download, FileText } from '@/components/icons';
import { Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { atsReport, buildCv, cvDocx, cvFileName, cvPdf } from '@/lib/domain/cv';
import { canSaveBytes, saveBytes } from '@/lib/files/saveBytes';
import { useTheme } from '@/theme';
import { useSiteStore } from '../state/siteStore';
import { TextAreaField } from '../fields/TextAreaField';
import { AtsChecklist } from './AtsChecklist';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Portfolio → CV: a CV built from the portfolio's visible items (unpublished edits
 * included), its ATS readiness, and downloads as PDF or Word. The phone number and the
 * job description stay on this screen: neither is saved or sent anywhere.
 */
export function CvPanel() {
  const theme = useTheme();
  const toast = useToast();
  const { profile, rows, messages, publication } = useSiteStore();
  const [phone, setPhone] = useState('');
  const [job, setJob] = useState('');
  const siteUrl =
    (typeof profile?.site_url === 'string' && profile.site_url) ||
    (Platform.OS === 'web' ? window.location.origin : '');
  const cv = useMemo(
    () => buildCv({ profile, rows, messages, publication }, { phone: phone.trim(), siteUrl }),
    [profile, rows, messages, publication, phone, siteUrl],
  );
  const report = useMemo(() => atsReport(cv, job), [cv, job]);

  const download = async (kind: 'pdf' | 'docx') => {
    try {
      const bytes = kind === 'pdf' ? cvPdf(cv) : cvDocx(cv);
      await saveBytes(bytes, cvFileName(cv, kind), kind === 'pdf' ? 'application/pdf' : DOCX);
    } catch {
      toast.show({ message: 'The CV could not be saved. Try again.' });
    }
  };

  return (
    <View style={{ gap: theme.space[4] }}>
      <Card index={0} style={{ gap: theme.space[4] }}>
        <CardHeader
          title="Download CV"
          subtitle="Built from your portfolio in the layout ATS read best: one column, standard headings, real text, dates on every role."
          action={<CategoryIcon icon={FileText} tint={2} size={40} />}
        />
        <TextField
          label="Phone (only on this CV, not saved)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91 …"
        />
        {canSaveBytes ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
            <Button label="Download PDF" icon={Download} onPress={() => void download('pdf')} />
            <Button
              label="Download Word"
              icon={Download}
              variant="secondary"
              onPress={() => void download('docx')}
            />
          </View>
        ) : (
          <Text variant="caption" color="textSecondary">
            Downloading the CV works in the web app for now.
          </Text>
        )}
        <Text variant="caption" color="textSecondary">
          Only items shown on your site are included, newest roles first. Edit them in the other
          tabs; the CV updates as you type.
        </Text>
      </Card>
      <Card index={1} style={{ gap: theme.space[4] }}>
        <CardHeader
          title="ATS readiness"
          subtitle="Ledgerly's own check, based on common ATS and recruiter guidance. Each employer's system scores differently."
        />
        <TextAreaField
          label="Job description (optional)"
          value={job}
          onChangeText={setJob}
          max={8000}
          rows={4}
          placeholder="Paste a job ad to see which of its keywords your CV has."
          hint="Checked on this device only."
        />
        <AtsChecklist report={report} />
      </Card>
    </View>
  );
}
