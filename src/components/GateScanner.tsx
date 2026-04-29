import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseQRString } from '../lib/parser';
import { verify } from '../lib/crypto';
import { processGate, checkQRFreshness, extractTxnId, getSavedStation, saveStation, GateStation, EventType } from '../lib/gate';
import { STATIONS } from '../constants/stations';

type ResultState = { type: EventType; station: string } | { error: string } | null;

export default function GateScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [station,   setStation]   = useState<GateStation | null>(getSavedStation());
  const [picker,    setPicker]    = useState(false);
  const [scanned,   setScanned]   = useState(false);
  const [running,   setRunning]   = useState(false);
  const [result,    setResult]    = useState<ResultState>(null);

  async function handleScan({ data }: { data: string }) {
    if (scanned || running || !station) return;
    setScanned(true);
    setRunning(true);
    setResult(null);
    try {
      const parsed = parseQRString(data);
      const ok     = await verify(parsed.plaintext, parsed.signature);
      if (!ok) throw new Error('Invalid QR signature');
      checkQRFreshness(parsed);
      const txnId = extractTxnId(parsed);
      const { type } = await processGate(txnId, parsed.dataset.commonData.fields.find(f => f.name === 'Ticket Serial No')?.hex ?? '', station);
      setResult({ type, station: station.name });
    } catch (e: unknown) {
      setResult({ error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  function reset() { setScanned(false); setResult(null); }

  function selectStation(s: GateStation) { saveStation(s); setStation(s); setPicker(false); }

  const isSuccess = result && !('error' in result);
  const isEntry   = isSuccess && (result as { type: EventType }).type === 'entry';

  return (
    <View style={styles.wrap}>
      {/* Station picker */}
      <TouchableOpacity style={styles.stationBtn} onPress={() => setPicker(true)}>
        <Text style={styles.stationLabel}>Gate Station</Text>
        <Text style={styles.stationName}>{station?.name ?? 'Tap to select →'}</Text>
      </TouchableOpacity>

      {!station ? (
        <View style={styles.noStation}><Text style={styles.noStationTxt}>Select a station to start scanning</Text></View>
      ) : !permission?.granted ? (
        <View style={styles.noStation}>
          <Text style={styles.noStationTxt}>Camera permission required</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnTxt}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          {!scanned && !running ? (
            <CameraView style={styles.camera} facing="back"
              onBarcodeScanned={handleScan}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
          ) : (
            <View style={styles.scanDone}>
              {running
                ? <ActivityIndicator color="#6366f1" size="large" />
                : result && (
                  <View style={[styles.resultBox, isSuccess ? (isEntry ? styles.entry : styles.exit) : styles.err]}>
                    <Text style={styles.resultIcon}>{isSuccess ? (isEntry ? '↓' : '↑') : '✕'}</Text>
                    <Text style={styles.resultTitle}>
                      {isSuccess
                        ? `${isEntry ? 'ENTRY' : 'EXIT'} recorded`
                        : 'Failed'}
                    </Text>
                    <Text style={styles.resultSub}>
                      {isSuccess
                        ? (result as { station: string }).station
                        : (result as { error: string }).error}
                    </Text>
                  </View>
                )
              }
            </View>
          )}
        </View>
      )}

      {scanned && (
        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetTxt}>Scan Next</Text>
        </TouchableOpacity>
      )}

      {/* Station picker modal */}
      <Modal visible={picker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Select Station</Text>
          <FlatList
            data={STATIONS}
            keyExtractor={s => String(s.code)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.stationRow} onPress={() => selectStation(item)}>
                <Text style={styles.stationRowName}>{item.name}</Text>
                <Text style={styles.stationRowLine}>{item.line}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setPicker(false)}>
            <Text style={styles.closeBtnTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:           { flex: 1 },
  stationBtn:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  stationLabel:   { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  stationName:    { fontSize: 16, color: '#0f172a', fontWeight: '700' },
  noStation:      { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noStationTxt:   { color: '#64748b', fontSize: 14 },
  permBtn:        { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  permBtnTxt:     { color: '#fff', fontWeight: '700' },
  cameraWrap:     { borderRadius: 16, overflow: 'hidden', aspectRatio: 1 },
  camera:         { flex: 1 },
  scanDone:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  resultBox:      { alignItems: 'center', padding: 32, borderRadius: 16, width: '80%', gap: 8 },
  entry:          { backgroundColor: '#f0fdf4' },
  exit:           { backgroundColor: '#eff6ff' },
  err:            { backgroundColor: '#fef2f2' },
  resultIcon:     { fontSize: 48, fontWeight: '900' },
  resultTitle:    { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  resultSub:      { fontSize: 14, color: '#64748b' },
  resetBtn:       { marginTop: 16, alignSelf: 'center', backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  resetTxt:       { color: '#fff', fontWeight: '700', fontSize: 15 },
  modal:          { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  stationRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 8 },
  stationRowName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  stationRowLine: { fontSize: 12, color: '#94a3b8' },
  closeBtn:       { marginTop: 12, alignSelf: 'center', padding: 14 },
  closeBtnTxt:    { color: '#6366f1', fontWeight: '700', fontSize: 15 },
});
