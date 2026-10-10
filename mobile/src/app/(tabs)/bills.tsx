import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FilePlus } from 'lucide-react-native';
import { useApi } from '@/lib/hooks';
import { fmtShort, inr } from '@/lib/format';
import { BILLING_LABEL, Bill, Customer } from '@/lib/types';
import { Badge, Button, Card, Chip, EmptyState, ErrorBanner, Header, Loading, Screen, Stat } from '@/components/ui';
import { GenerateBill } from '@/components/GenerateBill';

export default function Bills() {
  const router = useRouter();
  const [status, setStatus] = useState<'' | 'Generated' | 'PAID'>('');
  const [generating, setGenerating] = useState(false);
  const { data, loading, refreshing, error, refresh, reload } = useApi<Bill[]>('/bills', { status: status || undefined });
  const customers = useApi<Customer[]>('/customers', { active: 'true' });

  const pending = (data ?? []).filter((b) => b.status === 'Generated').reduce((s, b) => s + b.totalAmount, 0);
  const paid = (data ?? []).filter((b) => b.status === 'PAID').reduce((s, b) => s + b.totalAmount, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header
        title="Bills"
        subtitle="Generate and track payments"
        right={
          <Pressable onPress={() => setGenerating(true)} className="h-11 flex-row items-center gap-1.5 rounded-full bg-saffron px-4 active:opacity-80">
            <FilePlus size={18} color="#fff" />
            <Text className="font-bold text-white">New</Text>
          </Pressable>
        }
      />

      <View className="mb-4 flex-row gap-3">
        {status !== 'PAID' ? <Stat label="Pending" value={inr(pending)} tone="rose" /> : null}
        {status !== 'Generated' ? <Stat label="Paid" value={inr(paid)} tone="green" /> : null}
      </View>

      <View className="mb-4 flex-row">
        <Chip label="All" active={status === ''} onPress={() => setStatus('')} />
        <Chip label="Pending" active={status === 'Generated'} onPress={() => setStatus('Generated')} />
        <Chip label="Paid" active={status === 'PAID'} onPress={() => setStatus('PAID')} />
      </View>

      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No bills"
          body="Record some meals, then generate a bill for a customer."
          action={<Button title="Generate bill" onPress={() => setGenerating(true)} />}
        />
      ) : (
        data?.map((b) => (
          <Pressable key={b._id} onPress={() => router.push(`/bill/${b._id}`)} className="mb-3 active:opacity-80">
            <Card className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold text-ink">{b.customerName || 'Customer'}</Text>
                <Text className="mb-2 mt-0.5 text-xs text-muted">
                  {fmtShort(b.periodStart)} – {fmtShort(b.periodEnd)} · {BILLING_LABEL[b.billingType]}
                </Text>
                <Badge label={b.status === 'PAID' ? 'Paid' : 'Pending'} tone={b.status === 'PAID' ? 'green' : 'rose'} />
              </View>
              <Text className="text-lg font-extrabold text-ink">{inr(b.totalAmount)}</Text>
            </Card>
          </Pressable>
        ))
      )}

      <GenerateBill
        visible={generating}
        customers={customers.data ?? []}
        onClose={() => setGenerating(false)}
        onGenerated={(id) => {
          reload();
          router.push(`/bill/${id}`);
        }}
      />
    </Screen>
  );
}
