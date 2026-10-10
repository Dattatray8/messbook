import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { api, errMsg } from '@/lib/api';
import { BILLING_LABEL, BillingType, Customer } from '@/lib/types';
import { Button, Field, Segmented, Sheet } from './ui';

export function CustomerForm({
  visible,
  customer,
  onClose,
  onSaved,
}: {
  visible: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [billingType, setBillingType] = useState<BillingType>(customer?.billingType ?? 'PAY_PER_MEAL');
  const [planAmount, setPlanAmount] = useState(customer?.planAmount ? String(customer.planAmount) : '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPlan = billingType !== 'PAY_PER_MEAL';

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!/^[0-9+\-\s]{7,15}$/.test(phone.trim())) e.phone = 'Enter a valid phone number';
    if (isPlan && !(Number(planAmount) > 0)) e.planAmount = 'Enter the plan amount';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        billingType,
        planAmount: isPlan ? Number(planAmount) : 0,
      };
      if (customer) await api.patch(`/customers/${customer._id}`, body);
      else await api.post('/customers', body);
      onSaved();
      onClose();
    } catch (err) {
      Alert.alert('Could not save', errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Customer name" error={errors.name} />
      <Field
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="98575 XXXXX"
        error={errors.phone}
      />
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Billing</Text>
      <Segmented
        value={billingType}
        onChange={setBillingType}
        options={(Object.keys(BILLING_LABEL) as BillingType[]).map((v) => ({ value: v, label: BILLING_LABEL[v] }))}
      />
      {isPlan ? (
        <Field
          label={billingType === 'WEEKLY' ? 'Weekly plan amount (₹)' : 'Monthly plan amount (₹)'}
          value={planAmount}
          onChangeText={setPlanAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 2400"
          error={errors.planAmount}
        />
      ) : null}
      <Button title={customer ? 'Save changes' : 'Add customer'} onPress={save} loading={saving} />
    </Sheet>
  );
}
