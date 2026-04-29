import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import GateScanner from '@/components/GateScanner';

export default function GateScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GateScanner />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f8fafc' },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
});
