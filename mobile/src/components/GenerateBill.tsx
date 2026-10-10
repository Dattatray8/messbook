import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { api, errMsg } from '@/lib/api';
import { fmtDate, inr } from '@/lib/format';
import { BILLING_LABEL, BillPreview, Customer } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Loading, Row, Sheet } from './ui';

/** Two-step bill generation: pick customer (if not given) → preview → confirm. */
export function GenerateBill({
  visible,
  customerId: fixedCustomerId,
  customers,
  onClose,
  onGenerated,
}: {
  visible: boolean;
  customerId?: string;
  customers?: Customer[];
  onClose: () => void;
  onGenerated: (billId: string) => void;
}) {
  const [customerId, setCustomerId] = useState<string | undefined>(fixedCustomerId);
  const [preview, setPreview] = useState<BillPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPreview(null);
      setCustomerId(fixedCustomerId);
    } else if (fixedCustomerId) {
      setCustomerId(fixedCustomerId);
    }
  }, [visible, fixedCustomerId]);

  useEffect(() => {
    if (!visible || !customerId) return;
    let cancelled = false;
    setLoading(true);
    api
      .post<BillPreview>('/bills/generate', { customerId, preview: true })
      .then((r) => !cancelled && setPreview(r.data))
      .catch((e) => {
        if (cancelled) return;
        Alert.alert('Could not calculate bill', errMsg(e));
        setCustomerId(fixedCustomerId);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, customerId, fixedCustomerId]);

  const confirm = async () => {
    if (!customerId) return;
    setSaving(true);
    try {
      const res = await api.post<{ _id: string }>('/bills/generate', { customerId });
      onGenerated(res.data._id);
      onClose();
    } catch (e) {
      Alert.alert('Could not generate bill', errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const canGenerate = !!preview && preview.items.length > 0 && preview.totalAmount > 0 && !preview.alreadyBilled;

  return (
    <Sheet visible={visible} title="Generate bill" onClose={onClose}>
      {!customerId ? (
        (customers ?? []).length === 0 ? (
          <EmptyState title="No customers yet" body="Add a customer first." />
        ) : (
          (customers ?? []).map((c) => (
            <Pressable key={c._id} onPress={() => setCustomerId(c._id)} className="mb-2">
              <Card className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-bold text-ink">{c.name}</Text>
                  <Text className="text-xs text-muted">{BILLING_LABEL[c.billingType]}</Text>
                </View>
                <Text className="font-bold text-saffron">Select</Text>
              </Card>
            </Pressable>
          ))
        )
      ) : loading || !preview ? (
        <Loading />
      ) : (
        <View>
          <Text className="text-lg font-extrabold text-ink">{preview.customerName}</Text>
          <View className="mb-3 mt-1 flex-row items-center gap-2">
            <Badge label={BILLING_LABEL[preview.billingType]} tone="blue" />
            <Text className="text-xs text-muted">
              {fmtDate(preview.periodStart)} – {fmtDate(preview.periodEnd)}
            </Text>
          </View>

          {preview.alreadyBilled ? (
            <View className="mb-3 rounded-2xl bg-saffron-soft p-3">
              <Text className="text-sm font-semibold text-saffron">A bill already exists for this period.</Text>
            </View>
          ) : null}

          <Card>
            {preview.items.length === 0 ? (
              <Text className="text-sm text-muted">No unbilled meals in this period.</Text>
            ) : (
              preview.items.map((i, idx) => (
                <Row key={idx} label={`${i.name} × ${i.quantity}`} value={inr(i.amount)} />
              ))
            )}
            <View className="my-2 h-px bg-line" />
            <Row label="Total" value={inr(preview.totalAmount)} bold />
          </Card>

          {preview.coveredByPlanCount > 0 ? (
            <Text className="mt-3 text-xs text-muted">
              {preview.coveredByPlanCount} meal(s) are covered by the plan and won&apos;t be charged again.
            </Text>
          ) : null}

          <View className="mt-5">
            <Button title="Generate bill" onPress={confirm} loading={saving} disabled={!canGenerate} />
          </View>
        </View>
      )}
    </Sheet>
  );
}
