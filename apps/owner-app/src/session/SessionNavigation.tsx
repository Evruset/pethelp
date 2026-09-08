import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useSession } from './SessionProvider';

export function SessionNavigation() {
  const { status, retryValidation } = useSession();
  if (status === 'bootstrapping' || status === 'transitioning') {
    return (
      <View accessibilityLabel="Проверяем сессию" accessibilityRole="progressbar">
        <ActivityIndicator />
      </View>
    );
  }
  if(status==='recovering') return <View accessibilityRole="alert"><Text>Не удалось проверить вход</Text><Pressable accessibilityRole="button" onPress={()=>void retryValidation()}><Text>Повторить</Text></Pressable></View>;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'public'}>
        <Stack.Screen name="(public)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
