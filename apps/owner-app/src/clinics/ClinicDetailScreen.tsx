import { useQuery } from '@tanstack/react-query';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { useSession } from '@/session/SessionProvider';
import { Button, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { ClinicDecisionLayout, decisionColors } from './ClinicDecisionLayout';
import type { ClinicCatalogHandoff } from './clinic-catalog-api';
import { clinicServiceApi } from './clinic-service-api';

export function ClinicDetailScreen({ clinic, onBack, onChooseService }: {
  clinic: ClinicCatalogHandoff;
  onBack(): void;
  onChooseService(): void;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= t.layout.ownerV50WideMinWidth;
  const query = useQuery({
    queryKey: ['owner', session?.cacheScope, 'clinic-services', clinic.clinicId, clinic.locationId],
    enabled: Boolean(session),
    queryFn: ({ signal }) => clinicServiceApi.read(session!.opaqueCredential, clinic.clinicId, clinic.locationId, signal),
  });

  return <ClinicDecisionLayout eyebrow="Клиника" title={query.data?.name ?? 'Карточка клиники'} subtitle="Проверьте основные сведения и перейдите к выбору услуги." onBack={onBack}>
    {query.isPending ? <StateMessage kind="loading" title="Загружаем карточку клиники" /> : null}
    {query.isError ? <StateMessage kind="error" title="Не удалось открыть карточку клиники" action={<Button label="Повторить" onPress={() => { void query.refetch(); }} />} /> : null}
    {query.data ? <>
      <View style={{ padding: wide ? 24 : 16, gap: 16, borderWidth: 1, borderColor: decisionColors.border, borderRadius: 20, backgroundColor: decisionColors.surface, ...t.shadow.card }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: 16 }}>
          <View accessibilityLabel="Фотография клиники не предоставлена" style={{ width: wide ? 124 : '100%', height: wide ? 124 : 112, borderRadius: 16, backgroundColor: decisionColors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text accessibilityElementsHidden style={{ fontSize: 40, color: decisionColors.blue }}>⌂</Text>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32, fontWeight: '800', color: decisionColors.ink }}>{query.data.name}</Text>
            <Text style={{ ...t.typography.body, color: decisionColors.muted }}>{query.data.address}</Text>
            {query.data.phone ? <Text style={{ ...t.typography.body, color: decisionColors.blue }}>{query.data.phone}</Text> : null}
          </View>
          <View style={{ width: wide ? 224 : '100%', padding: 16, gap: 10, borderRadius: 16, backgroundColor: decisionColors.blueSoft }}>
            <Text style={{ ...t.typography.caption, color: decisionColors.blue, fontWeight: '800' }}>ОНЛАЙН-ЗАПИСЬ</Text>
            <Text style={{ ...t.typography.sectionTitle, color: decisionColors.ink }}>{query.data.services.length > 0 ? 'Можно выбрать услугу и время' : 'Услуги пока недоступны'}</Text>
            <Button label="Выбрать услугу" disabled={query.data.services.length === 0} onPress={onChooseService} />
          </View>
        </View>
      </View>
      <View style={{ padding: 18, gap: 8, borderRadius: 18, backgroundColor: decisionColors.surface, borderWidth: 1, borderColor: decisionColors.border }}>
        <Text style={{ ...t.typography.sectionTitle, color: decisionColors.ink }}>Что доступно</Text>
        <Text style={{ ...t.typography.secondaryBody, color: decisionColors.muted }}>{query.data.services.length > 0 ? `${query.data.services.length} ${query.data.services.length === 1 ? 'услуга доступна' : 'услуг доступно'} для онлайн-записи.` : 'Клиника пока не опубликовала услуги для онлайн-записи.'}</Text>
      </View>
    </> : null}
  </ClinicDecisionLayout>;
}
