import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Modal, FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseQRString } from '@/lib/parser';
import { verify, clearPublicKeyCache } from '@/lib/crypto';
import { checkQRFreshness, extractTxnId, processGate, GateStation, EventType } from '@/lib/gate';
import { STATIONS } from '@/constants/stations';

type Stage =
  | { name: 'scanning' }
  | { name: 'validating' }
  | { name: 'pick_station'; txnId: string; serial: string }
  | { name: 'recording'; station: GateStation; txnId: string; serial: string }
  | { name: 'done'; eventType: EventType; station: GateStation }
  | { name: 'error'; message: string };

export default function ValidateScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>({ name: 'scanning' });
  const [pickerOpen, setPickerOpen] = useState(false);

  async function onScanned({ data }: { data: string }) {
    if (stage.name !== 'scanning') return;
    setStage({ name: 'validating' });
    clearPublicKeyCache();
    try {
      const parsed = parseQRString(data);
      const ok     = await verify(parsed.plaintext, parsed.signature);
      if (!ok) throw new Error('Invalid QR signature');
      checkQRFreshness(parsed);
      const txnId  = extractTxnId(parsed);
      const serial = parsed.dataset.commonData.fields.find(f => f.name === 'Ticket Serial No')?.hex ?? '';
      setStage({ name: 'pick_station', txnId, serial });
      setPickerOpen(true);
    } catch (e: unknown) {
      setStage({ name: 'error', message: (e as Error).message });
    }
  }

  async function onStationPicked(station: GateStation) {
    setPickerOpen(false);
    if (stage.name !== 'pick_station') return;
    const { txnId, serial } = stage;
    setStage({ name: 'recording', station, txnId, serial });
    try {
      const { type } = await processGate(txnId, serial, station);
      setStage({ name: 'done', eventType: type, station });
    } catch (e: unknown) {
      setStage({ name: 'error', message: (e as Error).message });
    }
  }

  function reset() {
    setStage({ name: 'scanning' });
    setPickerOpen(false);
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.permText}>Camera permission required</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnTxt}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isScanning = stage.name === 'scanning';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Camera always rendered while scanning */}
      <View style={styles.cameraWrap}>
        {isScanning ? (
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={onScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        ) : (
          <View style={styles.cameraPlaceholder} />
        )}
        {isScanning && (
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.hint}>Point at SVP QR code</Text>
          </View>
        )}
      </View>

      {/* Status area */}
      <View style={styles.statusArea}>
        {stage.name === 'scanning' && (
          <Text style={styles.statusIdle}>Waiting for scan…</Text>
        )}

        {stage.name === 'validating' && (
          <View style={styles.center}>
            <ActivityIndicator color="#6366f1" size="large" />
            <Text style={styles.statusIdle}>Validating QR…</Text>
          </View>
        )}

        {stage.name === 'pick_station' && (
          <View style={styles.center}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>QR Valid</Text>
            <Text style={styles.successSub}>Select station to record event</Text>
            <TouchableOpacity style={styles.btn} onPress={() => setPickerOpen(true)}>
              <Text style={styles.btnTxt}>Choose Station</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage.name === 'recording' && (
          <View style={styles.center}>
            <ActivityIndicator color="#6366f1" size="large" />
            <Text style={styles.statusIdle}>Recording…</Text>
          </View>
        )}

        {stage.name === 'done' && (
          <View style={styles.center}>
            <Text style={[styles.doneIcon, stage.eventType === 'entry' ? styles.entryColor : styles.exitColor]}>
              {stage.eventType === 'entry' ? '↓' : '↑'}
            </Text>
            <Text style={styles.doneTitle}>
              {stage.eventType === 'entry' ? 'ENTRY' : 'EXIT'} Recorded
            </Text>
            <Text style={styles.doneSub}>{stage.station.name}</Text>
            <TouchableOpacity style={styles.btn} onPress={reset}>
              <Text style={styles.btnTxt}>Scan Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage.name === 'error' && (
          <View style={styles.center}>
            <Text style={styles.errIcon}>✕</Text>
            <Text style={styles.errTitle}>Rejected</Text>
            <Text style={styles.errMsg}>{stage.message}</Text>
            <TouchableOpacity style={[styles.btn, styles.btnRed]} onPress={reset}>
              <Text style={styles.btnTxt}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Station picker modal */}
      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Select Station</Text>
          <FlatList
            data={STATIONS}
            keyExtractor={s => String(s.code)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.stationRow} onPress={() => onStationPicked(item)}>
                <Text style={styles.stationName}>{item.name}</Text>
                <Text style={styles.stationLine}>{item.line}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#0f172a' },
  cameraWrap:       { flex: 1, position: 'relative' },
  camera:           { flex: 1 },
  cameraPlaceholder:{ flex: 1, backgroundColor: '#1e293b' },
  overlay:          { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scanFrame:        { width: 220, height: 220, borderWidth: 2, borderColor: '#6366f1', borderRadius: 16 },
  hint:             { color: '#cbd5e1', fontSize: 13 },
  statusArea:       { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 32, minHeight: 200 },
  center:           { alignItems: 'center', gap: 10 },
  statusIdle:       { color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center' },
  successIcon:      { fontSize: 52, color: '#16a34a', fontWeight: '900' },
  successTitle:     { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  successSub:       { fontSize: 13, color: '#64748b', marginBottom: 4 },
  doneIcon:         { fontSize: 52, fontWeight: '900' },
  entryColor:       { color: '#16a34a' },
  exitColor:        { color: '#2563eb' },
  doneTitle:        { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  doneSub:          { fontSize: 14, color: '#64748b' },
  errIcon:          { fontSize: 52, color: '#dc2626', fontWeight: '900' },
  errTitle:         { fontSize: 22, fontWeight: '800', color: '#dc2626' },
  errMsg:           { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 16 },
  btn:              { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  btnRed:           { backgroundColor: '#dc2626' },
  btnTxt:           { color: '#fff', fontWeight: '700', fontSize: 15 },
  modal:            { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  modalTitle:       { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  stationRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 8 },
  stationName:      { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  stationLine:      { fontSize: 12, color: '#94a3b8' },
  cancelBtn:        { alignSelf: 'center', padding: 16, marginTop: 8 },
  cancelTxt:        { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
