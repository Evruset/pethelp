import { Text, View } from 'react-native';
import { uiTokens as t } from '@/ui/tokens';

export function BookingSelectionSummary({ petName, clinicName, address, serviceName, price, time }: {
  petName?: string;
  clinicName: string;
  address?: string;
  serviceName?: string;
  price?: string;
  time?: string;
}) {
  const facts = [
    { label: 'Питомец', value: petName },
    { label: 'Клиника', value: clinicName },
    { label: 'Адрес', value: address },
    { label: 'Услуга', value: serviceName },
    { label: 'Ориентировочная стоимость', value: price },
    { label: 'Дата и время', value: time },
  ].filter((fact) => Boolean(fact.value));

  return (
    <View accessibilityLabel="Выбранные данные записи" style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 10 }}>
      <Text accessibilityRole="header" style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>
        Ваша запись
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {facts.map((fact) => (
          <View key={fact.label} style={{ flexGrow: 1, flexBasis: 140, minWidth: 0, gap: 3 }}>
            <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{fact.label}</Text>
            <Text accessibilityLabel={`${fact.label}: ${fact.value}`} style={{ ...t.typography.secondaryBody, color: t.ownerHome.ink, fontWeight: '700' }}>
              {fact.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
