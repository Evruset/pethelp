import { Text, View } from 'react-native';
import { uiTokens as t } from '@/ui/tokens';

const steps = ['Питомец', 'Клиника и услуга', 'Время', 'Проверка'];

export function BookingProgress({ current, facts = [] }: { current: 1 | 2 | 3 | 4; facts?: string[] }) {
  return (
    <View accessibilityLabel={`Этап записи ${current} из 4`} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {steps.map((step, index) => {
          const reached = index < current;
          return (
            <View key={step} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 4, borderRadius: 4, backgroundColor: reached ? t.ownerHome.blue : t.ownerHome.border }} />
              <Text numberOfLines={1} style={{ ...t.typography.caption, color: reached ? t.ownerHome.ink : t.ownerHome.muted, fontWeight: reached ? '700' : '500' }}>{step}</Text>
            </View>
          );
        })}
      </View>
      {facts.length ? <Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>{facts.join('  ·  ')}</Text> : null}
    </View>
  );
}
