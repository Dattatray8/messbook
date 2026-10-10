import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, inr } from '@/lib/format';
import { BILLING_LABEL, Bill, MealRecord, titleCase } from '@/lib/types';
import { Badge, Button, Card, ErrorBanner, Loading, Row, Screen } from '@/components/ui';

interface Details {
  bill: Bill;
  meals: MealRecord[];
  customer: { name: string; phone: string } | null;
}

export default function BillDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, refreshing, error, refresh, reload } = useApi<Details>(`/bills/${id}`);
  const [saving, setSaving] = useState(false);

  const setPaid = async (paid: boolean) => {
    setSaving(true);
    try {
      await api.patch(`/bills/${id}/${paid ? 'pay' : 'unpay'}`);
      reload();
    } catch (e) {
      Alert.alert('Could not update payment', errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const bill = data?.bill;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Pressable onPress={() => router.back()} className="mb-3 flex-row items-center self-start" hitSlop={10}>
        <ChevronLeft size={22} color="#17211d" />
        <Text className="text-base font-semibold text-ink">Back</Text>
      </Pressable>

      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : bill ? (
        <>
          <View className="mb-5 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-extrabold text-ink">{data.customer?.name ?? bill.customerName}</Text>
              <Text className="mt-0.5 text-sm text-muted">
                {fmtDate(bill.periodStart)} – {fmtDate(bill.periodEnd)}
              </Text>
              <View className="mt-2 flex-row gap-2">
                <Badge label={BILLING_LABEL[bill.billingType]} tone="blue" />
                <Badge label={bill.status === 'PAID' ? 'Paid' : 'Pending'} tone={bill.status === 'PAID' ? 'green' : 'rose'} />
              </View>
            </View>
          </View>

          <Card className="mb-5">
            <Text className="mb-2 text-sm font-bold text-ink">Charges</Text>
            {bill.items.map((i, idx) => (
              <View key={idx} className={`py-2 ${idx > 0 ? 'border-t border-line' : ''}`}>
                <Row label={i.name} value={inr(i.amount)} />
                <Text className="-mt-1 text-xs text-muted">
                  {i.quantity} × {inr(i.unitPrice)}
                </Text>
              </View>
            ))}
            <View className="my-2 h-px bg-line" />
            <Row label="Total" value={inr(bill.totalAmount)} bold />
            {bill.paidAt ? <Text className="mt-1 text-xs text-leaf">Paid on {fmtDate(bill.paidAt)}</Text> : null}
          </Card>

          {bill.status === 'Generated' ? (
            <Button title="Mark as paid" onPress={() => setPaid(true)} loading={saving} />
          ) : (
            <Button title="Mark as unpaid" variant="secondary" onPress={() => setPaid(false)} loading={saving} />
          )}

          <Text className="mb-2 mt-8 text-sm font-bold text-ink">Meals in this bill ({data.meals.length})</Text>
          <Card>
            {data.meals.length === 0 ? (
              <Text className="text-sm text-muted">No meals linked.</Text>
            ) : (
              data.meals.map((m, idx) => (
                <View key={m._id} className={`flex-row justify-between py-2 ${idx > 0 ? 'border-t border-line' : ''}`}>
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-semibold text-ink">
                      {m.mealName} × {m.mealQuantity}
                    </Text>
                    <Text className="text-xs text-muted">
                      {fmtDate(m.mealDate)} · {titleCase(m.mealType)}
                    </Text>
                  </View>
                  <Text className="text-sm text-muted">
                    {bill.billingType !== 'PAY_PER_MEAL' && m.category !== 'EXTRA' ? 'In plan' : inr(m.totalAmount)}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
