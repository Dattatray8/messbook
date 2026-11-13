import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Zap } from 'lucide-react-native';
import { api, errMsg } from '@/lib/api';
import { fmtDateIST, fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useNotifications } from '@/lib/notifications-context';
import {
  AutomationRunRow,
  AutomationSettings,
  AutomationStatus,
  GenerateNowPreview,
  GenerateNowResult,
} from '@/lib/types';
import { Badge, Button, Card, ErrorBanner, Row } from './ui';

const STATUS: Record<AutomationStatus, { label: string; tone: 'green' | 'saffron' | 'rose' | 'blue' | 'muted'; hint: string }> = {
  DISABLED: { label: 'Off', tone: 'muted', hint: 'Bills are only created when you generate them yourself.' },
  AWAITING_CONFIGURATION: {
    label: 'Setup pending',
    tone: 'saffron',
    hint: 'Automatic generation is switched on, but the server scheduler is not configured yet, so nothing will run automatically.',
  },
  AWAITING_FIRST_RUN: {
    label: 'Waiting for first run',
    tone: 'blue',
    hint: 'Switched on. No scheduled run has been recorded yet.',
  },
  ACTIVE: { label: 'Active', tone: 'green', hint: 'Scheduled runs are happening.' },
  ERROR: { label: 'Needs attention', tone: 'rose', hint: 'The last scheduled run failed.' },
};

const RUN_TONE = { SUCCESS: 'green', PARTIAL: 'saffron', FAILED: 'rose', SKIPPED: 'muted', RUNNING: 'blue' } as const;

export function AutomationSection() {
  const router = useRouter();
  const { refreshUnread } = useNotifications();
  const settings = useApi<AutomationSettings>('/automation/settings');
  const runs = useApi<AutomationRunRow[]>('/automation/runs', { limit: 5 });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showRuns, setShowRuns] = useState(false);

  const s = settings.data;

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await api.patch('/automation/settings', { enabled });
      settings.reload();
    } catch (e) {
      Alert.alert('Could not update', errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const reloadAll = () => {
    settings.reload();
    runs.reload();
    void refreshUnread();
  };

  const summarize = (r: GenerateNowResult) => {
    const lines = [
      `Created: ${r.created}`,
      `Already billed (skipped): ${r.skippedAlreadyBilled}`,
      `Nothing to bill (skipped): ${r.skippedNothingToBill}`,
      `Failed: ${r.failed}`,
    ];
    if (r.failures.length) {
      lines.push('', ...r.failures.slice(0, 3).map((f) => `• ${f.customerName ?? 'Customer'}: ${f.reason}`));
      if (r.failures.length > 3) lines.push(`…and ${r.failures.length - 3} more`);
    }
    if (r.hasMore) lines.push('', 'More customers remain. Run again to continue.');
    const title = r.status === 'SUCCESS' ? 'Bills generated' : r.status === 'PARTIAL' ? 'Partly completed' : 'Could not generate bills';
    Alert.alert(title, lines.join('\n'), [{ text: 'OK' }, { text: 'View bills', onPress: () => router.push('/bills') }]);
  };

  const generateNow = async () => {
    setGenerating(true);
    try {
      // Step 1: ask the server what is due; nothing is created yet.
      const pre = (await api.post<GenerateNowPreview>('/automation/generate-now', { dryRun: true })).data;
      if (pre.toProcess === 0) {
        Alert.alert(
          'Nothing to generate',
          pre.eligibleCustomers === 0
            ? 'No weekly or monthly customers have a completed billing period yet.'
            : 'Every due period has already been billed.',
        );
        return;
      }
      // Step 2: explicit confirmation before creating bills.
      Alert.alert(
        'Generate bills now?',
        `${pre.toProcess} customer${pre.toProcess === 1 ? '' : 's'} have a completed weekly or monthly period to bill` +
          (pre.alreadyBilled ? ` (${pre.alreadyBilled} already billed will be skipped).` : '.') +
          '\n\nPay-per-meal customers are billed from the Bills tab.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Generate',
            onPress: async () => {
              setGenerating(true);
              try {
                const r = (await api.post<GenerateNowResult>('/automation/generate-now', {})).data;
                summarize(r);
              } catch (e) {
                Alert.alert('Could not generate bills', errMsg(e));
              } finally {
                setGenerating(false);
                reloadAll();
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Could not check what is due', errMsg(e));
    } finally {
      setGenerating(false);
    }
  };

  const st = s ? STATUS[s.status] : null;

  return (
    <View className="mb-6">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Automatic Bill Generation</Text>
      {settings.error ? <ErrorBanner message={settings.error} onRetry={settings.reload} /> : null}
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-3 pr-3">
            <Zap size={20} color="#ef8b35" />
            <Text className="text-base font-bold text-ink">Generate bills automatically</Text>
          </View>
          <Switch
            value={!!s?.enabled}
            disabled={!s || saving}
            onValueChange={(v) => void toggle(v)}
            trackColor={{ true: '#ef8b35' }}
            accessibilityLabel="Generate bills automatically"
          />
        </View>
        <Text className="mt-2 text-sm text-muted">
          When on, a bill is created for each weekly or monthly customer once their billing period has finished, following
          each customer&apos;s own billing frequency. This only controls scheduled billing. You can always generate bills
          yourself below.
        </Text>

        {s && st ? (
          <View className="mt-3">
            <View className="mb-2 flex-row items-center gap-2">
              <Badge label={st.label} tone={st.tone} />
              <Text className="flex-1 text-xs text-muted">{st.hint}</Text>
            </View>
            <Row label="Timezone" value={s.timezone} />
            <Row label="Last scheduled run" value={s.lastScheduledRunAt ? fmtDateTime(s.lastScheduledRunAt) : 'Never'} />
            <Row label="Current week closes" value={fmtDateIST(s.nextPeriodCloses.weekly)} />
            <Row label="Current month closes" value={fmtDateIST(s.nextPeriodCloses.monthly)} />
            <Text className="mt-1 text-xs text-muted">
              New bills are created on the first scheduled run after a period closes.
            </Text>

            {s.lastRun ? (
              <View className="mt-3 rounded-2xl bg-canvas p-3">
                <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Last run</Text>
                <Text className="text-sm text-ink">
                  {s.lastRun.created} created · {s.lastRun.skipped} skipped · {s.lastRun.failed} failed
                </Text>
                {s.lastRun.errorSummary ? <Text className="mt-1 text-xs text-rose">{s.lastRun.errorSummary}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      <View className="mt-3">
        <Button title="Generate Bills Now" onPress={() => void generateNow()} loading={generating} />
        <Text className="mt-2 text-xs text-muted">
          Works whether or not automatic generation is on. Safe to repeat: a period is never billed twice.
        </Text>
      </View>

      <Pressable onPress={() => router.push('/bills')} className="mt-3">
        <Card className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-ink">View bills</Text>
          <ChevronRight size={18} color="#6f7a73" />
        </Card>
      </Pressable>

      <Pressable onPress={() => setShowRuns((v) => !v)} className="mt-3">
        <Card className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-ink">Recent runs</Text>
          <Text className="text-xs font-semibold text-saffron">{showRuns ? 'Hide' : 'Show'}</Text>
        </Card>
      </Pressable>
      {showRuns ? (
        <Card className="mt-2">
          {runs.error ? <ErrorBanner message={runs.error} onRetry={runs.reload} /> : null}
          {(runs.data ?? []).length === 0 ? (
            <Text className="text-sm text-muted">No runs yet.</Text>
          ) : (
            (runs.data ?? []).map((r) => (
              <View key={r.runId} className="border-b border-line py-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-ink">
                    {r.trigger === 'MANUAL' ? 'Manual' : 'Scheduled'} · {fmtDateTime(r.startedAt)}
                  </Text>
                  <Badge label={r.status.charAt(0) + r.status.slice(1).toLowerCase()} tone={RUN_TONE[r.status]} />
                </View>
                <Text className="mt-0.5 text-xs text-muted">
                  {r.created} created · {r.skippedAlreadyBilled + r.skippedNothingToBill} skipped · {r.failed} failed
                </Text>
                {r.errorSummary ? <Text className="text-xs text-rose">{r.errorSummary}</Text> : null}
              </View>
            ))
          )}
        </Card>
      ) : null}
    </View>
  );
}
