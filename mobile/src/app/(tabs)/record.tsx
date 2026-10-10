import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react-native';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useMess } from '@/lib/mess-context';
import { addDaysLocal, inr, isSameDay, toDayString } from '@/lib/format';
import { Customer, MEAL_TYPES, MealRecord, MealType, MenuItem, titleCase } from '@/lib/types';
import { Button, Card, Chip, EmptyState, Header, Screen, Sheet } from '@/components/ui';

export default function RecordMeals() {
  const params = useLocalSearchParams<{ customerId?: string }>();
  const { mess } = useMess();
  const enabledTypes = mess?.mealTypes?.length ? mess.mealTypes : MEAL_TYPES;

  const [date, setDate] = useState(new Date());
  const [mealType, setMealType] = useState<MealType>(enabledTypes[0] ?? 'LUNCH');
  const [customerId, setCustomerId] = useState<string | undefined>(params.customerId);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [picker, setPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.customerId) setCustomerId(params.customerId);
  }, [params.customerId]);

  const customers = useApi<Customer[]>('/customers', { active: 'true' });
  const menu = useApi<MenuItem[]>('/menu-items', { active: 'true' });
  const day = toDayString(date);
  const meals = useApi<MealRecord[]>('/meal-records', { date: day });

  const customer = customers.data?.find((c) => c._id === customerId);
  const visibleItems = useMemo(
    () => (menu.data ?? []).filter((i) => i.category === mealType || i.category === 'EXTRA'),
    [menu.data, mealType],
  );
  const lines = visibleItems.filter((i) => (qty[i._id] ?? 0) > 0);
  const total = lines.reduce((s, i) => s + i.price * (qty[i._id] ?? 0), 0);

  const change = (id: string, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  const save = async () => {
    if (!customerId) return Alert.alert('Choose a customer', 'Select who ate this meal.');
    if (lines.length === 0) return Alert.alert('Add items', 'Choose at least one menu item.');
    setSaving(true);
    try {
      await api.post('/meal-records', {
        customerId,
        mealType,
        mealDate: day,
        items: lines.map((i) => ({ menuItemId: i._id, quantity: qty[i._id] })),
      });
      setQty({});
      meals.reload();
    } catch (e) {
      Alert.alert('Could not record meal', errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (m: MealRecord) =>
    Alert.alert('Delete this entry?', `${m.mealName} × ${m.mealQuantity} for ${m.customerName}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/meal-records/${m._id}`);
            meals.reload();
          } catch (e) {
            Alert.alert('Could not delete', errMsg(e));
          }
        },
      },
    ]);

  const filteredCustomers = (customers.data ?? []).filter((c) =>
    `${c.name} ${c.phone}`.toLowerCase().includes(pickerSearch.toLowerCase()),
  );

  return (
    <Screen
      refreshing={meals.refreshing}
      onRefresh={() => {
        meals.refresh();
        menu.reload();
        customers.reload();
      }}
    >
      <Header title="Record meals" subtitle="Quick entry for busy meal times" />

      {/* Date */}
      <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-line bg-white px-2 py-1.5">
        <Pressable onPress={() => setDate((d) => addDaysLocal(d, -1))} hitSlop={8} className="p-2">
          <ChevronLeft size={22} color="#17211d" />
        </Pressable>
        <Pressable onPress={() => setDate(new Date())}>
          <Text className="text-base font-bold text-ink">
            {isSameDay(date, new Date())
              ? 'Today · '
              : ''}
            {date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </Pressable>
        <Pressable onPress={() => setDate((d) => addDaysLocal(d, 1))} hitSlop={8} className="p-2">
          <ChevronRight size={22} color="#17211d" />
        </Pressable>
      </View>

      {/* Meal type */}
      <View className="mb-4 flex-row">
        {enabledTypes.map((m) => (
          <Chip key={m} label={titleCase(m)} active={mealType === m} onPress={() => setMealType(m)} />
        ))}
      </View>

      {/* Customer */}
      <Pressable onPress={() => setPicker(true)} className="mb-5">
        <Card className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-bold uppercase tracking-wide text-muted">Customer</Text>
            <Text className={`mt-0.5 text-base font-bold ${customer ? 'text-ink' : 'text-muted'}`}>
              {customer ? customer.name : 'Tap to choose'}
            </Text>
          </View>
          <Text className="font-bold text-saffron">{customer ? 'Change' : 'Select'}</Text>
        </Card>
      </Pressable>

      {/* Items */}
      <Text className="mb-2 text-sm font-bold text-ink">Items</Text>
      {menu.data && visibleItems.length === 0 ? (
        <EmptyState title="No menu items" body="Add items in Menu (from Settings) first." />
      ) : (
        visibleItems.map((i) => {
          const q = qty[i._id] ?? 0;
          return (
            <Card key={i._id} className={`mb-2 flex-row items-center justify-between ${q > 0 ? 'border-saffron' : ''}`}>
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold text-ink">{i.name}</Text>
                <Text className="text-sm text-muted">
                  {inr(i.price)} / {i.unit}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Pressable onPress={() => change(i._id, -1)} className="h-9 w-9 items-center justify-center rounded-full bg-line">
                  <Minus size={16} color="#17211d" />
                </Pressable>
                <Text className="w-6 text-center text-base font-extrabold text-ink">{q}</Text>
                <Pressable onPress={() => change(i._id, 1)} className="h-9 w-9 items-center justify-center rounded-full bg-saffron">
                  <Plus size={16} color="#fff" />
                </Pressable>
              </View>
            </Card>
          );
        })
      )}

      <View className="mb-8 mt-3">
        <Button title={total > 0 ? `Save · ${inr(total)}` : 'Save meal'} onPress={save} loading={saving} />
      </View>

      {/* Day log */}
      <Text className="mb-2 text-sm font-bold text-ink">Recorded on this day</Text>
      {(meals.data ?? []).length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <Card>
          {(meals.data ?? []).map((m, idx) => (
            <View key={m._id} className={`flex-row items-center justify-between py-2.5 ${idx > 0 ? 'border-t border-line' : ''}`}>
              <View className="flex-1 pr-3">
                <Text className="text-sm font-semibold text-ink">
                  {m.customerName} · {m.mealName} × {m.mealQuantity}
                </Text>
                <Text className="text-xs text-muted">
                  {titleCase(m.mealType)} · {inr(m.totalAmount)}
                  {m.billId ? ' · Billed' : ''}
                </Text>
              </View>
              {!m.billId ? (
                <Pressable onPress={() => remove(m)} hitSlop={10}>
                  <Trash2 size={18} color="#c96a69" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={picker} title="Choose customer" onClose={() => setPicker(false)}>
        <TextInput
          value={pickerSearch}
          onChangeText={setPickerSearch}
          placeholder="Search customers"
          placeholderTextColor="#a3aca6"
          className="mb-3 h-12 rounded-2xl border border-line bg-white px-4 text-base text-ink"
        />
        {filteredCustomers.length === 0 ? (
          <EmptyState title="No customers found" body="Add customers from the Customers tab." />
        ) : (
          <ScrollView scrollEnabled={false}>
            {filteredCustomers.map((c) => (
              <Pressable
                key={c._id}
                onPress={() => {
                  setCustomerId(c._id);
                  setPicker(false);
                  setPickerSearch('');
                }}
                className="mb-2"
              >
                <Card className={customerId === c._id ? 'border-saffron' : ''}>
                  <Text className="text-base font-bold text-ink">{c.name}</Text>
                  <Text className="text-sm text-muted">{c.phone}</Text>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </Screen>
  );
}
