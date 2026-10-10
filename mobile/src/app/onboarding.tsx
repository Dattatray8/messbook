import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api, errMsg } from '@/lib/api';
import { useMess } from '@/lib/mess-context';
import { Mess, MEAL_TYPES, MealType, titleCase } from '@/lib/types';
import { Button, Chip, Field, Header, Screen } from '@/components/ui';

export default function Onboarding() {
  const { setMess } = useMess();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mealTypes, setMealTypes] = useState<MealType[]>([...MEAL_TYPES]);
  const [loading, setLoading] = useState(false);

  const toggle = (m: MealType) =>
    setMealTypes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Mess name required', 'Enter the name of your mess.');
    if (mealTypes.length === 0) return Alert.alert('Pick meals', 'Enable at least one meal type.');
    setLoading(true);
    try {
      const res = await api.post<Mess>('/mess', { name: name.trim(), phone: phone.trim() || undefined, mealTypes });
      setMess(res.data); // Gate then routes to the dashboard
    } catch (e) {
      Alert.alert('Could not set up mess', errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View className="pt-6">
        <Header title="Set up your mess" subtitle="This takes under a minute. You can change it later in Settings." />
      </View>
      <Field label="Mess name" value={name} onChangeText={setName} placeholder="Annapurna Mess" />
      <Field label="Contact number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98575 XXXXX" />
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Meals you serve</Text>
      <View className="mb-8 flex-row flex-wrap">
        {MEAL_TYPES.map((m) => (
          <Chip key={m} label={titleCase(m)} active={mealTypes.includes(m)} onPress={() => toggle(m)} />
        ))}
      </View>
      <Button title="Create my mess" onPress={submit} loading={loading} />
    </Screen>
  );
}
