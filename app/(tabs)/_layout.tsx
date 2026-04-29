import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#F5F4FF',
          borderTopColor:  'rgba(0,0,0,0.06)',
        },
        headerStyle:         { backgroundColor: '#ffffff' },
        headerTintColor:     '#0f172a',
        headerTitleStyle:    { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Validate',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
          headerTitle: 'Event Log',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Generator',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
          headerTitle: 'SVP QR Generator',
        }}
      />
      <Tabs.Screen name="verify" options={{ href: null }} />
      <Tabs.Screen name="gate"   options={{ href: null }} />
    </Tabs>
  );
}
