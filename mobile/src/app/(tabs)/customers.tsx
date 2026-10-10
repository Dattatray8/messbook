import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useApi } from '@/lib/hooks';
import { inr } from '@/lib/format';
import { BILLING_LABEL, Customer } from '@/lib/types';
import { Badge, Card, Chip, EmptyState, ErrorBanner, Header, Loading, Screen, Button } from '@/components/ui';
import { CustomerForm } from '@/components/CustomerForm';

export default function Customers() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<'all' | 'true' | 'false'>('true');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, refreshing, error, refresh, reload } = useApi<Customer[]>('/customers', {
    search: debounced || undefined,
    active: filter === 'all' ? undefined : filter,
  });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header
        title="Customers"
        subtitle={data ? `${data.length} shown` : undefined}
        right={
          <Pressable onPress={() => setShowForm(true)} className="h-11 w-11 items-center justify-center rounded-full bg-saffron active:opacity-80">
            <Plus size={22} color="#fff" />
          </Pressable>
        }
      />

      <View className="mb-3 h-12 flex-row items-center gap-2 rounded-2xl border border-line bg-white px-4">
        <Search size={18} color="#6f7a73" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or phone"
          placeholderTextColor="#a3aca6"
          className="flex-1 text-base text-ink"
        />
      </View>
      <View className="mb-4 flex-row">
        <Chip label="Active" active={filter === 'true'} onPress={() => setFilter('true')} />
        <Chip label="Inactive" active={filter === 'false'} onPress={() => setFilter('false')} />
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
      </View>

      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : data && data.length === 0 ? (
        <EmptyState
          title={debounced ? 'No matches' : 'No customers yet'}
          body={debounced ? 'Try a different name or number.' : 'Add your first customer to start recording meals.'}
          action={debounced ? undefined : <Button title="Add customer" onPress={() => setShowForm(true)} />}
        />
      ) : (
        data?.map((c) => (
          <Pressable key={c._id} onPress={() => router.push(`/customer/${c._id}`)} className="mb-3 active:opacity-80">
            <Card className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold text-ink">{c.name}</Text>
                <Text className="mb-2 mt-0.5 text-sm text-muted">{c.phone}</Text>
                <View className="flex-row gap-2">
                  <Badge label={BILLING_LABEL[c.billingType]} tone="blue" />
                  {!c.isActive ? <Badge label="Inactive" tone="muted" /> : null}
                </View>
              </View>
              {(c.outstanding ?? 0) > 0 ? (
                <View className="items-end">
                  <Text className="text-xs text-muted">Owes</Text>
                  <Text className="text-base font-extrabold text-rose">{inr(c.outstanding)}</Text>
                </View>
              ) : null}
            </Card>
          </Pressable>
        ))
      )}

      {showForm ? <CustomerForm visible onClose={() => setShowForm(false)} onSaved={reload} /> : null}
    </Screen>
  );
}
