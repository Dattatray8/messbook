import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight, LogOut } from 'lucide-react-native';
import { api, errMsg } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { useMess } from '@/lib/mess-context';
import { Mess, MEAL_TYPES, MealType, titleCase } from '@/lib/types';
import { Button, Card, Chip, Field, Header, Row, Screen } from '@/components/ui';

export default function SettingsScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { mess, setMess } = useMess();
  const [name, setName] = useState(mess?.name ?? '');
  const [phone, setPhone] = useState(mess?.phone ?? '');
  const [mealTypes, setMealTypes] = useState<MealType[]>(mess?.mealTypes ?? [...MEAL_TYPES]);
  const [saving, setSaving] = useState(false);

  const toggle = (m: MealType) =>
    setMealTypes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const save = async () => {
    if (!name.trim()) return Alert.alert('Mess name required', 'Enter the name of your mess.');
    if (mealTypes.length === 0) return Alert.alert('Pick meals', 'Enable at least one meal type.');
    setSaving(true);
    try {
      const res = await api.patch<Mess>('/mess/me', { name: name.trim(), phone: phone.trim(), mealTypes });
      setMess(res.data);
      Alert.alert('Saved', 'Mess details updated.');
    } catch (e) {
      Alert.alert('Could not save', errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const logout = () =>
    Alert.alert('Log out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await authClient.signOut();
          setMess(null);
        },
      },
    ]);

  const user = session?.user as { name?: string; email?: string; phone?: string } | undefined;

  return (
    <Screen>
      <Header title="Settings" />

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Owner profile</Text>
      <Card className="mb-6">
        <Row label="Name" value={user?.name ?? '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Phone" value={user?.phone ?? '—'} />
      </Card>

      <Pressable onPress={() => router.push('/menu')} className="mb-6">
        <Card className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <BookOpen size={20} color="#ef8b35" />
            <Text className="text-base font-bold text-ink">Menu & prices</Text>
          </View>
          <ChevronRight size={20} color="#6f7a73" />
        </Card>
      </Pressable>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Mess details</Text>
      <Field label="Mess name" value={name} onChangeText={setName} />
      <Field label="Contact number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Meals you serve</Text>
      <View className="mb-5 flex-row flex-wrap">
        {MEAL_TYPES.map((m) => (
          <Chip key={m} label={titleCase(m)} active={mealTypes.includes(m)} onPress={() => toggle(m)} />
        ))}
      </View>
      <Button title="Save changes" onPress={save} loading={saving} />

      <View className="mt-8">
        <Button title="Log out" variant="danger" onPress={logout} icon={<LogOut size={18} color="#c96a69" />} />
      </View>
    </Screen>
  );
}
