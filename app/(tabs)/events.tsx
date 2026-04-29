import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView, View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { fetchEvents } from '@/lib/supabase';
import type { GateEvent } from '@/lib/gate';

export default function EventsScreen() {
  const [events,     setEvents]     = useState<GateEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await fetchEvents(100);
      setEvents(data as GateEvent[]);
    } catch (_) {}
    refresh ? setRefreshing(false) : setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 40 }} color="#6366f1" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={events}
        keyExtractor={(_, i) => String(i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No events yet</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, item.event === 'entry' ? styles.entryRow : styles.exitRow]}>
            <Text style={styles.badge}>{item.event === 'entry' ? '↓ IN' : '↑ OUT'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.station}>{item.station_name}</Text>
              <Text style={styles.txn} numberOfLines={1}>{item.txn_id}</Text>
            </View>
            <Text style={styles.time}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#f8fafc' },
  list:     { padding: 16, paddingBottom: 40 },
  empty:    { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  entryRow: { borderLeftColor: '#16a34a' },
  exitRow:  { borderLeftColor: '#2563eb' },
  badge:    { fontSize: 10, fontWeight: '800', color: '#64748b', width: 44 },
  station:  { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  txn:      { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' },
  time:     { fontSize: 11, color: '#64748b' },
});
