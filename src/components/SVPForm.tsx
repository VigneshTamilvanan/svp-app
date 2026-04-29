import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';

export interface FormValues {
  balanceRupees: string;
  mobile: string;
  txnRef: string;
  refreshSecs: string;
}

interface Props {
  values: FormValues;
  onChange: (values: FormValues) => void;
  onGenerate: () => void;
  loading: boolean;
}

function randomTxnRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 22 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function SVPForm({ values, onChange, onGenerate, loading }: Props) {
  const set = (key: keyof FormValues) => (val: string) =>
    onChange({ ...values, [key]: val });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>SVP Configuration</Text>

      <View style={styles.field}>
        <Text style={styles.label}>SVP Balance (₹)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={values.balanceRupees}
          onChangeText={set('balanceRupees')}
          placeholderTextColor="#64748b"
          placeholder="500"
        />
        <Text style={styles.hint}>Min ₹50 · Fare deducted at exit by AFC</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          maxLength={10}
          value={values.mobile}
          onChangeText={set('mobile')}
          placeholderTextColor="#64748b"
          placeholder="9876543210"
        />
        <Text style={styles.hint}>10 digits — encoded in QR (Table 5.4)</Text>
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>TXN Reference No</Text>
          <TouchableOpacity onPress={() => set('txnRef')(randomTxnRef())}>
            <Text style={styles.badge}>Random</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          maxLength={22}
          autoCapitalize="characters"
          value={values.txnRef}
          onChangeText={set('txnRef')}
          placeholderTextColor="#64748b"
          placeholder="22-char payment reference"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>QR Refresh Interval (seconds)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={values.refreshSecs}
          onChangeText={set('refreshSecs')}
          placeholderTextColor="#64748b"
          placeholder="30"
        />
        <Text style={styles.hint}>TAG 84 refreshes on this interval</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={onGenerate}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Generate SVP QR</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  field: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
    fontWeight: '500',
  },
  hint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  badge: {
    fontSize: 11,
    color: '#6366f1',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  btn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
