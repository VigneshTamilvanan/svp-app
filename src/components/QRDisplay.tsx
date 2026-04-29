import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { serialDisplay, toHex } from '../lib/dataset';
import { CMRL } from '../constants/stations';
import { SVP_DEFAULTS } from '../constants/spec';

interface Props {
  result: {
    dataset: {
      commonData: { serial: string };
      dynamicData: { fields: Array<{ name: string; hex: string }> };
    };
    finalPayload: string;
  } | null;
  countdown: number;
  refreshSecs: number;
  sessionExpired: boolean;
  onResume: () => void;
  loading: boolean;
}

function CountdownRing({ countdown, refreshSecs }: { countdown: number; refreshSecs: number }) {
  const urgent = countdown <= Math.min(5, Math.floor(refreshSecs * 0.15));
  const frac   = Math.max(0, countdown) / refreshSecs;

  return (
    <View style={ring.row}>
      <View style={ring.track}>
        <Text style={[ring.number, urgent && ring.urgent]}>{countdown}</Text>
      </View>
      <View>
        <Text style={[ring.label, urgent && ring.urgentLabel]}>
          {urgent ? 'Refreshing soon…' : 'Next refresh in'}
        </Text>
        <Text style={ring.sub}>{countdown}s / {refreshSecs}s interval · {(frac * 100).toFixed(0)}%</Text>
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  track:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0ff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#6366f1' },
  number:      { fontSize: 14, fontWeight: '800', color: '#6366f1', fontFamily: 'monospace' },
  urgent:      { color: '#ef4444' },
  urgentLabel: { color: '#ef4444' },
  label:       { fontSize: 12, fontWeight: '700', color: '#64748b' },
  sub:         { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});

export default function QRDisplay({ result, countdown, refreshSecs, sessionExpired, onResume, loading }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: sessionExpired ? 0.2 : 1, duration: 300, useNativeDriver: true }).start();
  }, [sessionExpired]);

  if (!result) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Generated QR Code</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Fill the form and tap{'\n'}<Text style={{ fontWeight: '700' }}>Generate SVP QR</Text></Text>
        </View>
      </View>
    );
  }

  const { dataset, finalPayload } = result;
  const serial  = dataset.commonData.serial;
  const balField = dataset.dynamicData.fields.find(f => f.name === 'Op-specific Dynamic Data');
  const bal      = balField ? `₹${parseInt(balField.hex.slice(0, 8), 16) / 100}` : '—';

  const infoRows = [
    { label: 'Journey',         value: 'ANY → ANY (open SVP)' },
    { label: 'SVP Balance',     value: bal },
    { label: 'Fare',            value: 'Deducted at exit by AFC' },
    { label: 'Validity',        value: `${SVP_DEFAULTS.VALIDITY_MINS} min (8 hrs)` },
    { label: 'Journey Timeout', value: `${SVP_DEFAULTS.DURATION_MINS} min` },
    { label: 'Product',         value: `SVP (0x${toHex(CMRL.PRODUCT_SVP, 2)})` },
    { label: 'Security',        value: 'RSA-2048 / SHA-256 · Scheme 0x03' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Generated QR Code</Text>
      <View style={styles.badge}><Text style={styles.badgeText}>STORE VALUE PASS</Text></View>

      <View style={styles.qrWrap}>
        <Animated.View style={{ opacity }}>
          <QRCode
            value={finalPayload}
            size={220}
            backgroundColor="#ffffff"
            color="#000000"
            ecl="L"
          />
        </Animated.View>
        {sessionExpired && (
          <View style={styles.expiredOverlay}>
            <Text style={styles.expiredTitle}>Session expired</Text>
            <Text style={styles.expiredSub}>10 min limit reached</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={onResume} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.resumeText}>Resume</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.serial}>{serialDisplay(serial)}</Text>

      {!sessionExpired && countdown > 0 && (
        <CountdownRing countdown={countdown} refreshSecs={refreshSecs} />
      )}

      <View style={styles.infoCard}>
        {infoRows.map(r => (
          <View key={r.label} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{r.label}</Text>
            <Text style={styles.infoValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:            { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle:       { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12, letterSpacing: 0.3 },
  badge:           { alignSelf: 'flex-start', backgroundColor: '#eef2ff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 16 },
  badgeText:       { fontSize: 10, fontWeight: '800', color: '#6366f1', letterSpacing: 1 },
  qrWrap:          { alignItems: 'center', marginBottom: 12, position: 'relative' },
  expiredOverlay:  { position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  expiredTitle:    { fontSize: 13, fontWeight: '800', color: '#ef4444' },
  expiredSub:      { fontSize: 12, color: '#94a3b8' },
  resumeBtn:       { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8, marginTop: 4 },
  resumeText:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  serial:          { fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', textAlign: 'center', marginBottom: 4 },
  placeholder:     { alignItems: 'center', paddingVertical: 40 },
  placeholderText: { color: '#94a3b8', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  infoCard:        { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  infoLabel:       { fontSize: 12, color: '#64748b', flex: 1 },
  infoValue:       { fontSize: 12, color: '#6366f1', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
