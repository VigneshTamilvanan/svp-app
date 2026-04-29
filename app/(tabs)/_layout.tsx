import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   '#818cf8',
        tabBarInactiveTintColor: '#475569',
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor:  '#1e293b',
        },
        headerStyle:            { backgroundColor: '#0f172a' },
        headerTintColor:        '#e2e8f0',
        headerTitleStyle:       { fontWeight: '700' },
        headerShadowVisible:    false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Generate QR',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
          headerTitle: 'SVP QR Generator',
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: 'Verify QR',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
          headerTitle: 'QR Verifier',
        }}
      />
    </Tabs>
  );
}
