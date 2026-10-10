import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { inr } from '@/lib/format';
import { CATEGORIES, Category, MenuItem, titleCase } from '@/lib/types';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Header, Loading, Screen, Sheet } from '@/components/ui';
import { ScrollView } from 'react-native';

function ItemForm({ item, onClose, onSaved }: { item: MenuItem | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [unit, setUnit] = useState(item?.unit ?? 'plate');
  const [category, setCategory] = useState<Category>(item?.category ?? 'LUNCH');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Enter the item name.');
    if (price === '' || Number(price) < 0 || Number.isNaN(Number(price))) return Alert.alert('Price required', 'Enter a valid price.');
    setSaving(true);
    try {
      const body = { name: name.trim(), price: Number(price), unit: unit.trim() || 'plate', category };
      if (item) await api.patch(`/menu-items/${item._id}`, body);
      else await api.post('/menu-items', body);
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('Could not save', errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible title={item ? 'Edit item' : 'Add menu item'} onClose={onClose}>
      <Field label="Item name" value={name} onChangeText={setName} placeholder="Veg thali" />
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {CATEGORIES.map((c) => (
          <Chip key={c} label={titleCase(c)} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>
      <Field label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="80" />
      <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="plate, cup, piece" />
      {item ? (
        <Text className="mb-4 text-xs text-muted">Changing the price only affects meals recorded from now on. Old bills keep their amounts.</Text>
      ) : null}
      <Button title={item ? 'Save changes' : 'Add item'} onPress={save} loading={saving} />
    </Sheet>
  );
}

export default function MenuManagement() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh, reload } = useApi<MenuItem[]>('/menu-items');
  const [editing, setEditing] = useState<MenuItem | null | undefined>(undefined); // undefined = closed, null = new

  const toggle = async (item: MenuItem) => {
    try {
      await api.patch(`/menu-items/${item._id}`, { isActive: !item.isActive });
      reload();
    } catch (e) {
      Alert.alert('Could not update', errMsg(e));
    }
  };

  const grouped = CATEGORIES.map((c) => ({ category: c, items: (data ?? []).filter((i) => i.category === c) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Pressable onPress={() => router.back()} className="mb-3 flex-row items-center self-start" hitSlop={10}>
        <ChevronLeft size={22} color="#17211d" />
        <Text className="text-base font-semibold text-ink">Back</Text>
      </Pressable>
      <Header
        title="Menu"
        subtitle="Prices used when recording meals"
        right={
          <Pressable onPress={() => setEditing(null)} className="h-11 w-11 items-center justify-center rounded-full bg-saffron">
            <Plus size={22} color="#fff" />
          </Pressable>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : grouped.length === 0 ? (
        <EmptyState title="No menu items" body="Add the items you serve and their prices." action={<Button title="Add item" onPress={() => setEditing(null)} />} />
      ) : (
        grouped.map((g) => (
          <View key={g.category} className="mb-5">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{titleCase(g.category)}</Text>
            {g.items.map((item) => (
              <Pressable key={item._id} onPress={() => setEditing(item)} className="mb-2">
                <Card className={`flex-row items-center justify-between ${item.isActive ? '' : 'opacity-60'}`}>
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-bold text-ink">{item.name}</Text>
                    <Text className="text-sm text-muted">
                      {inr(item.price)} / {item.unit}
                    </Text>
                  </View>
                  <Switch
                    value={item.isActive}
                    onValueChange={() => toggle(item)}
                    trackColor={{ true: '#ef8b35', false: '#e4e9e2' }}
                  />
                </Card>
              </Pressable>
            ))}
          </View>
        ))
      )}
      {editing !== undefined ? <ItemForm item={editing} onClose={() => setEditing(undefined)} onSaved={reload} /> : null}
    </Screen>
  );
}
