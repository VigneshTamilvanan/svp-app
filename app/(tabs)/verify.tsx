import React from 'react';
import { ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import QRVerifier from '@/components/QRVerifier';

export default function VerifyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <QRVerifier />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0f172a' },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
});
