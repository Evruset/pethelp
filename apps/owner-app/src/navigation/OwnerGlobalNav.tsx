import { Pressable, Text, View } from 'react-native';
import { uiTokens as t } from '@/ui/tokens';

type Area = 'HOME' | 'PETS' | 'CLINICS';

export function OwnerGlobalNav({ desktop, active, onHome, onPets, onClinics }: {
  desktop: boolean; active: Area; onHome(): void; onPets(): void; onClinics(): void;
}) {
  const items = [
    { area: 'HOME' as const, label: 'Главная', icon: '⌂', action: onHome },
    { area: 'PETS' as const, label: 'Питомцы', icon: '●', action: onPets },
    { area: 'CLINICS' as const, label: 'Клиники', icon: '▥', action: onClinics },
  ];
  return (
    <View accessibilityLabel="Основная навигация" style={{ minHeight: desktop ? 66 : 68, marginHorizontal: desktop ? 24 : 8, marginTop: desktop ? 14 : 6, marginBottom: desktop ? 0 : 8, paddingHorizontal: 8, borderWidth: 1, borderColor: t.ownerHome.border, borderRadius: desktop ? 20 : 22, backgroundColor: 'rgba(255,255,255,.98)', flexDirection: 'row', alignItems: 'center', justifyContent: desktop ? 'center' : 'space-around', gap: desktop ? 5 : 0, ...t.shadow.card }}>
      {desktop ? <Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink, position: 'absolute', left: 16 }}>✦ VetHelp</Text> : null}
      {items.map((item) => {
        const selected = item.area === active;
        return <Pressable key={item.area} accessibilityRole="button" accessibilityState={{ selected }} onPress={item.action} style={({ pressed }) => ({ minHeight: desktop ? 44 : 52, minWidth: desktop ? undefined : 68, paddingHorizontal: desktop ? 14 : 7, paddingVertical: 6, borderRadius: 14, backgroundColor: selected ? t.ownerHome.blueSoft : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: desktop ? 'row' : 'column', gap: desktop ? 7 : 1, opacity: pressed ? .65 : 1 })}>
          <Text style={{ fontSize: desktop ? 16 : 18, color: selected ? t.ownerHome.bluePressed : t.ownerHome.muted }}>{item.icon}</Text>
          <Text style={{ ...t.typography.caption, fontSize: desktop ? 13 : 10, color: selected ? t.ownerHome.bluePressed : t.ownerHome.muted, fontWeight: selected ? '700' : '600' }}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  );
}
