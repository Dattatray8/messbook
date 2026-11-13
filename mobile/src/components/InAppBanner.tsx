import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, X } from 'lucide-react-native';

export interface BannerItem {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** Single in-app presentation for notifications that arrive while the app is open. */
export function InAppBanner({
  item,
  onPress,
  onDismiss,
}: {
  item: BannerItem | null;
  onPress: (item: BannerItem) => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!item) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, zIndex: 100 }}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => onPress(item)}
        className="flex-row items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-lg active:opacity-90"
        style={{ elevation: 6 }}
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron-soft">
          <Bell size={18} color="#ef8b35" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-ink" numberOfLines={1}>
            {item.title}
          </Text>
          {item.body ? (
            <Text className="text-xs text-muted" numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss">
          <X size={18} color="#6f7a73" />
        </Pressable>
      </Pressable>
    </View>
  );
}
