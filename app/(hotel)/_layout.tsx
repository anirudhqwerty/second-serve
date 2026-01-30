import { Stack } from 'expo-router';

export default function HotelLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create-listing" />
      <Stack.Screen name="listings" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="conversation/[id]" />
    </Stack>
  );
}