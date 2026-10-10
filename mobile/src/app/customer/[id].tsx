import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, FilePlus, Pencil, Plus } from 'lucide-react-native';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtShort, inr } from '@/lib/format';
import { BILLING_LABEL, Bill, Customer, MealRecord, titleCase } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Screen, Stat } from '@/components/ui';
import { CustomerForm } from '@/components/CustomerForm';
import { GenerateBill } from '@/components/GenerateBill';

interface Details {
  customer: Customer;
  meals: MealRecord[];
  bills: Bill[];
  summary: { outstanding: number; totalPaid: number; unbilledAmount: number };
}

export default function CustomerDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, refreshing, error, refresh, reload } = useApi<Details>(`/customers/${id}`);
  const [editing, setEditing] = useState(false);
  const [billing, setBilling] = useState(false);

  const toggleActive = async () => {
    if (!data) return;
    try {
      await api.patch(`/customers/${id}`, { isActive: !data.customer.isActive });
      reload();
    } catch (e) {
      Alert.alert('Could not update', errMsg(e));
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Pressable onPress={() => router.back()} className="mb-3 flex-row items-center self-start" hitSlop={10}>
        <ChevronLeft size={22} color="#17211d" />
        <Text className="text-base font-semibold text-ink">Back</Text>
      </Pressable>

      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <>
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-extrabold text-ink">{data.customer.name}</Text>
              <Text className="mt-0.5 text-sm text-muted">{data.customer.phone}</Text>
              <View className="mt-2 flex-row gap-2">
                <Badge label={BILLING_LABEL[data.customer.billingType]} tone="blue" />
                {data.customer.billingType !== 'PAY_PER_MEAL' ? (
                  <Badge label={`${inr(data.customer.planAmount)} plan`} tone="saffron" />
                ) : null}
                {!data.customer.isActive ? <Badge label="Inactive" tone="muted" /> : null}
              </View>
            </View>
            <Pressable onPress={() => setEditing(true)} className="h-11 w-11 items-center justify-center rounded-full border border-line bg-white">
              <Pencil size={18} color="#17211d" />
            </Pressable>
          </View>

          <View className="mb-3 flex-row gap-3">
            <Stat label="Outstanding" value={inr(data.summary.outstanding)} tone="rose" />
            <Stat label="Not yet billed" value={inr(data.summary.unbilledAmount)} tone="saffron" />
          </View>
          <View className="mb-5 flex-row gap-3">
            <Stat label="Total paid" value={inr(data.summary.totalPaid)} tone="green" />
          </View>

          <View className="mb-6 flex-row gap-3">
            <Button
              title="Generate bill"
              onPress={() => setBilling(true)}
              icon={<FilePlus size={18} color="#fff" />}
              className="flex-1"
            />
            <Button
              title="Record meal"
              variant="secondary"
              onPress={() => router.push({ pathname: '/record', params: { customerId: id } })}
              icon={<Plus size={18} color="#17211d" />}
              className="flex-1"
            />
          </View>

          <Text className="mb-2 text-sm font-bold text-ink">Bills</Text>
          {data.bills.length === 0 ? (
            <EmptyState title="No bills yet" body="Generate a bill once meals are recorded." />
          ) : (
            data.bills.map((b) => (
              <Pressable key={b._id} onPress={() => router.push(`/bill/${b._id}`)} className="mb-2">
                <Card className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm font-semibold text-ink">
                      {fmtShort(b.periodStart)} – {fmtDate(b.periodEnd)}
                    </Text>
                    <View className="mt-1">
                      <Badge label={b.status === 'PAID' ? 'Paid' : 'Pending'} tone={b.status === 'PAID' ? 'green' : 'rose'} />
                    </View>
                  </View>
                  <Text className="text-base font-extrabold text-ink">{inr(b.totalAmount)}</Text>
                </Card>
              </Pressable>
            ))
          )}

          <Text className="mb-2 mt-6 text-sm font-bold text-ink">Meal history</Text>
          {data.meals.length === 0 ? (
            <EmptyState title="No meals recorded" />
          ) : (
            <Card>
              {data.meals.map((m, i) => (
                <View key={m._id} className={`flex-row items-center justify-between py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-semibold text-ink">
                      {m.mealName} × {m.mealQuantity}
                    </Text>
                    <Text className="text-xs text-muted">
                      {fmtDate(m.mealDate)} · {titleCase(m.mealType)}
                      {m.billId ? ' · Billed' : ''}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-ink">{inr(m.totalAmount)}</Text>
                </View>
              ))}
            </Card>
          )}

          <View className="mt-6">
            <Button
              title={data.customer.isActive ? 'Mark as inactive' : 'Mark as active'}
              variant={data.customer.isActive ? 'danger' : 'secondary'}
              onPress={toggleActive}
            />
          </View>

          {editing ? <CustomerForm visible customer={data.customer} onClose={() => setEditing(false)} onSaved={reload} /> : null}
          <GenerateBill
            visible={billing}
            customerId={String(id)}
            onClose={() => setBilling(false)}
            onGenerated={(billId) => {
              reload();
              router.push(`/bill/${billId}`);
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
