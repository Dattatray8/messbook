import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

export const COLORS = {
  saffron: '#ef8b35',
  ink: '#17211d',
  muted: '#6f7a73',
  leaf: '#3d8b69',
  rose: '#c96a69',
  sky: '#527ba2',
};

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['top'],
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom')[];
  padded?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: padded ? 20 : 0, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.saffron} /> : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="mb-5 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-2xl font-extrabold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-3xl border border-line bg-white p-4 ${className}`}>{children}</View>;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  className = '',
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const styles: Record<Variant, string> = {
    primary: 'bg-saffron',
    secondary: 'bg-white border border-line',
    danger: 'bg-rose-soft border border-rose/30',
    ghost: 'bg-transparent',
  };
  const text: Record<Variant, string> = {
    primary: 'text-white',
    secondary: 'text-ink',
    danger: 'text-rose',
    ghost: 'text-saffron',
  };
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5 active:opacity-80 ${styles[variant]} ${off ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#fff' : COLORS.saffron} /> : icon}
      <Text className={`text-base font-bold ${text[variant]}`}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  rightElement,
  ...props
}: TextInputProps & { label: string; error?: string; rightElement?: ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</Text>
      <View>
        <TextInput
          placeholderTextColor="#a3aca6"
          className={`h-12 rounded-2xl border bg-white px-4 text-base text-ink ${rightElement ? 'pr-12' : ''} ${error ? 'border-rose' : 'border-line'}`}
          {...props}
        />
        {rightElement ? <View className="absolute right-3 top-0 h-12 items-center justify-center">{rightElement}</View> : null}
      </View>
      {error ? <Text className="mt-1 text-xs text-rose">{error}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full border px-4 py-2 ${active ? 'border-saffron bg-saffron' : 'border-line bg-white'}`}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'green' | 'saffron' | 'rose' | 'blue' | 'muted' }) {
  const map = {
    green: ['bg-leaf-soft', 'text-leaf'],
    saffron: ['bg-saffron-soft', 'text-saffron'],
    rose: ['bg-rose-soft', 'text-rose'],
    blue: ['bg-sky-soft', 'text-sky'],
    muted: ['bg-line', 'text-muted'],
  } as const;
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${map[tone][0]}`}>
      <Text className={`text-xs font-bold ${map[tone][1]}`}>{label}</Text>
    </View>
  );
}

export function Stat({
  label,
  value,
  tone = 'saffron',
  icon,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'saffron' | 'rose' | 'blue';
  icon?: ReactNode;
}) {
  const bg = { green: 'bg-leaf-soft', saffron: 'bg-saffron-soft', rose: 'bg-rose-soft', blue: 'bg-sky-soft' }[tone];
  return (
    <View className={`flex-1 rounded-3xl p-4 ${bg}`}>
      {icon}
      <Text className="mt-2 text-2xl font-extrabold text-ink">{value}</Text>
      <Text className="mt-0.5 text-xs font-semibold text-muted">{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View className="items-center rounded-3xl border border-dashed border-line bg-white px-6 py-10">
      <Text className="text-base font-bold text-ink">{title}</Text>
      {body ? <Text className="mt-1 text-center text-sm text-muted">{body}</Text> : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color={COLORS.saffron} />
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="mb-4 rounded-2xl bg-rose-soft p-4">
      <Text className="text-sm font-semibold text-rose">{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} className="mt-2">
          <Text className="text-sm font-bold text-ink">Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className={`text-sm ${bold ? 'font-bold text-ink' : 'text-muted'}`}>{label}</Text>
      <Text className={`text-sm ${bold ? 'text-lg font-extrabold text-ink' : 'font-semibold text-ink'}`}>{value}</Text>
    </View>
  );
}

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <View className="max-h-[88%] rounded-t-[32px] bg-canvas">
          <View className="flex-row items-center justify-between px-5 pb-2 pt-5">
            <Text className="text-xl font-extrabold text-ink">{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full bg-line">
              <X size={18} color={COLORS.ink} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="mb-4 flex-row rounded-2xl bg-line p-1">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          className={`flex-1 items-center rounded-xl py-2.5 ${value === o.value ? 'bg-white' : ''}`}
        >
          <Text className={`text-sm font-bold ${value === o.value ? 'text-ink' : 'text-muted'}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
