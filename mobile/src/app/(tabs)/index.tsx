import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, IndianRupee, Plus, Users, UtensilsCrossed, Wallet } from 'lucide-react-native';
import { useApi } from '@/lib/hooks';
import { useMess } from '@/lib/mess-context';
import { inr } from '@/lib/format';
import { DashboardData, MEAL_TYPES, titleCase } from '@/lib/types';
import { Card, ErrorBanner, Header, Loading, Screen, Stat } from '@/components/ui';

export default function Dashboard() {
  const router = useRouter();
  const { mess } = useMess();
  const { data, loading, refreshing, error, refresh, reload } = useApi<DashboardData>('/dashboard');

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header title={mess?.name ?? 'MessBook'} subtitle={today} />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <>
          <View className="mb-3 flex-row gap-3">
            <Stat label="Meals today" value={String(data.todayMeals)} tone="saffron" icon={<UtensilsCrossed size={20} color="#ef8b35" />} />
            <Stat label="Today's sales" value={inr(data.todayRevenue)} tone="green" icon={<IndianRupee size={20} color="#3d8b69" />} />
          </View>
          <View className="mb-5 flex-row gap-3">
            <Stat label={`Active customers (${data.totalCustomers} total)`} value={String(data.activeCustomers)} tone="blue" icon={<Users size={20} color="#527ba2" />} />
            <Stat label={`Pending · ${data.pendingBillsCount} bill(s)`} value={inr(data.pendingAmount)} tone="rose" icon={<Wallet size={20} color="#c96a69" />} />
          </View>

          <Card className="mb-5">
            <Text className="mb-3 text-sm font-bold text-ink">Today by meal</Text>
            <View className="flex-row">
              {MEAL_TYPES.map((m) => (
                <View key={m} className="flex-1 items-center">
                  <Text className="text-2xl font-extrabold text-ink">{data.mealsByType[m] ?? 0}</Text>
                  <Text className="text-xs text-muted">{titleCase(m)}</Text>
                </View>
              ))}
            </View>
          </Card>

          <View className="mb-5 flex-row gap-3">
            <Pressable onPress={() => router.push('/record')} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-saffron active:opacity-80">
              <Plus size={20} color="#fff" />
              <Text className="text-base font-bold text-white">Record meal</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/menu')} className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-white active:opacity-80">
              <BookOpen size={20} color="#17211d" />
              <Text className="text-base font-bold text-ink">Menu</Text>
            </Pressable>
          </View>

          <Text className="mb-2 text-sm font-bold text-ink">Who owes you</Text>
          {data.topPending.length === 0 ? (
            <Card>
              <Text className="text-sm text-muted">All bills are settled. 🎉</Text>
            </Card>
          ) : (
            data.topPending.map((p) => (
              <Pressable key={p.customerId} onPress={() => router.push(`/customer/${p.customerId}`)} className="mb-2">
                <Card className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-ink">{p.name}</Text>
                  <Text className="text-base font-extrabold text-rose">{inr(p.amount)}</Text>
                </Card>
              </Pressable>
            ))
          )}
          {data.unbilledAmount > 0 ? (
            <Text className="mt-3 text-xs text-muted">{inr(data.unbilledAmount)} of recorded meals not yet billed.</Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
