import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { verify, clearPublicKeyCache } from '../lib/crypto';
import { parseQRString } from '../lib/parser';
import PayloadBreakdown from './PayloadBreakdown';

type ParsedResult = ReturnType<typeof parseQRString>;

function extractSummary(parsed: ParsedResult) {
  const balField  = parsed.dataset.dynamicData.fields.find(f => f.name === 'Op-specific Dynamic Data');
  const mobField  = parsed.dataset.commonData.fields.find(f => f.name === 'Mobile');
  const balance   = balField ? `₹${parseInt(balField.hex.slice(0, 8), 16) / 100}` : '—';
  const mobile    = mobField?.hex ?? '—';
  return { balance, mobile };
}

export default function QRVerifier() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode,        setMode]        = useState<'camera' | 'text'>('camera');
  const [scanned,     setScanned]     = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [running,     setRunning]     = useState(false);
  const [verifyOk,    setVerifyOk]    = useState<boolean | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [parsed,      setParsed]      = useState<ParsedResult | null>(null);

  async function runVerify(raw: string) {
    setRunning(true);
    setVerifyOk(null);
    setVerifyError(null);
    setParsed(null);
    clearPublicKeyCache();
    try {
      const result = parseQRString(raw);
      const ok     = await verify(result.plaintext, result.signature);
      setVerifyOk(ok);
      setParsed(result);
    } catch (e: unknown) {
      setVerifyOk(false);
      setVerifyError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    runVerify(data);
  }

  function reset() {
    setScanned(false);
    setVerifyOk(null);
    setVerifyError(null);
    setParsed(null);
    setManualInput('');
  }

  const summary = parsed && verifyOk ? extractSummary(parsed) : null;

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>QR Signature Verifier</Text>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'camera' && styles.modeBtnActive]}
            onPress={() => { setMode('camera'); reset(); }}
          >
            <Text style={[styles.modeTxt, mode === 'camera' && styles.modeTxtActive]}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'text' && styles.modeBtnActive]}
            onPress={() => { setMode('text'); reset(); }}
          >
            <Text style={[styles.modeTxt, mode === 'text' && styles.modeTxtActive]}>Paste</Text>
          </TouchableOpacity>
        </View>

        {mode === 'camera' && (
          <>
            {!permission?.granted ? (
              <View style={styles.permBox}>
                <Text style={styles.permText}>Camera access needed to scan QR tickets.</Text>
                <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                  <Text style={styles.permBtnText}>Grant Camera Access</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cameraWrap}>
                {!scanned && !running ? (
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  />
                ) : (
                  <View style={styles.scanDone}>
                    {running
                      ? <ActivityIndicator color="#6366f1" size="large" />
                      : <Text style={styles.scanDoneText}>QR scanned — see results below</Text>
                    }
                  </View>
                )}
              </View>
            )}
            {(scanned || verifyOk !== null) && (
              <TouchableOpacity style={styles.resetBtn} onPress={reset}>
                <Text style={styles.resetTxt}>Scan Another</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {mode === 'text' && (
          <>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={5}
              placeholder="{03|04|…}|{…}|{(…|[…])}|{SIG:…}"
              placeholderTextColor="#94a3b8"
              value={manualInput}
              onChangeText={t => { setManualInput(t); reset(); setManualInput(t); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.verifyBtn, (!manualInput.trim() || running) && styles.btnDisabled]}
              onPress={() => runVerify(manualInput)}
              disabled={!manualInput.trim() || running}
            >
              {running
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.verifyBtnTxt}>Verify Signature</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {verifyOk !== null && (
          <View style={[styles.result, verifyOk ? styles.resultOk : styles.resultFail]}>
            <Text style={[styles.resultIcon, verifyOk ? styles.okIcon : styles.failIcon]}>
              {verifyOk ? '✓' : '✕'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, verifyOk ? styles.okText : styles.failText]}>
                {verifyOk ? 'Signature Valid' : 'Signature Invalid'}
              </Text>
              <Text style={styles.resultSub}>
                {verifyOk
                  ? 'RSA-2048 / SHA-256 verified against current public key'
                  : verifyError ?? 'Signature did not match — wrong key or tampered payload'
                }
              </Text>
            </View>
          </View>
        )}

        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SVP Balance</Text>
              <Text style={styles.summaryValue}>{summary.balance}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Mobile</Text>
              <Text style={styles.summaryValue}>{summary.mobile}</Text>
            </View>
          </View>
        )}
      </View>

      {parsed && <PayloadBreakdown result={parsed} defaultOpen={false} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card:          { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle:     { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 14, letterSpacing: 0.3 },
  modeRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn:       { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  modeBtnActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  modeTxt:       { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  modeTxtActive: { color: '#6366f1' },
  permBox:       { alignItems: 'center', paddingVertical: 24, gap: 12 },
  permText:      { color: '#64748b', fontSize: 13, textAlign: 'center' },
  permBtn:       { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  permBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  cameraWrap:    { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  camera:        { width: '100%', height: 260 },
  scanDone:      { height: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 12 },
  scanDoneText:  { color: '#64748b', fontSize: 13 },
  resetBtn:      { alignSelf: 'center', marginTop: 4, paddingVertical: 8, paddingHorizontal: 20 },
  resetTxt:      { color: '#6366f1', fontWeight: '700', fontSize: 13 },
  textarea:      { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, color: '#0f172a', fontFamily: 'monospace', fontSize: 11, minHeight: 100, marginBottom: 10, textAlignVertical: 'top' },
  verifyBtn:     { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnDisabled:   { opacity: 0.4 },
  verifyBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  result:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 10, padding: 14, marginTop: 14, borderWidth: 1.5 },
  resultOk:      { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  resultFail:    { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  resultIcon:    { fontSize: 26, fontWeight: '900', marginTop: 1 },
  okIcon:        { color: '#16a34a' },
  failIcon:      { color: '#dc2626' },
  resultTitle:   { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  okText:        { color: '#15803d' },
  failText:      { color: '#dc2626' },
  resultSub:     { fontSize: 12, color: '#64748b', lineHeight: 18 },
  summaryCard:   { backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  summaryLabel:  { fontSize: 13, color: '#64748b', fontWeight: '500' },
  summaryValue:  { fontSize: 15, color: '#0f172a', fontWeight: '700', fontFamily: 'monospace' },
});
