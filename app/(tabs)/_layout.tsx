import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor:  '#e2e8f0',
        },
        headerStyle:            { backgroundColor: '#ffffff' },
        headerTintColor:        '#0f172a',
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
