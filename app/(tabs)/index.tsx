import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity,
  Modal, FlatList, Animated, ScrollView, Dimensions, Easing,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Line } from 'react-native-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseQRString } from '@/lib/parser';
import { verify, clearPublicKeyCache } from '@/lib/crypto';
import { checkQRFreshness, processGate, extractMobileNumber, GateStation } from '@/lib/gate';
import { getLastEvent } from '@/lib/supabase';
import { STATIONS } from '@/constants/stations';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CAMERA_H = Math.round(SCREEN_H * 0.36);
const FRAME_SIZE = 160;

interface QRInfo { balance: string; mobile: string; mobileNumber: string; txnId: string; serial: string; }

function extractInfo(parsed: ReturnType<typeof parseQRString>): QRInfo {
  const cd      = parsed.dataset.commonData.fields;
  const dd      = parsed.dataset.dynamicData.fields;
  const balHex  = dd.find(f => f.name === 'Op-specific Dynamic Data')?.hex ?? '00000000';
  const mobileHex = cd.find(f => f.name === 'Mobile')?.hex ?? '00000000';
  return {
    balance:      `₹${parseInt(balHex.slice(0, 8), 16) / 100}`,
    mobile:       mobileHex,
    mobileNumber: extractMobileNumber(mobileHex),
    txnId:        cd.find(f => f.name === 'Ticket Serial No')?.hex ?? '—',
    serial:       cd.find(f => f.name === 'Ticket Serial No')?.hex ?? '—',
  };
}

type Stage =
  | { name: 'scanning' }
  | { name: 'validating' }
  | { name: 'entry_info'; info: QRInfo }
  | { name: 'exit_info';  info: QRInfo; entryStation: string }
  | { name: 'recording' }
  | { name: 'happy_journey' }
  | { name: 'thank_you'; from: string; to: string }
  | { name: 'denied'; reason: string }
  | { name: 'error'; message: string };

/* ─── tiny helpers ─── */

function AutoReset({ onReset, delay }: { onReset: () => void; delay: number }) {
  useEffect(() => { const t = setTimeout(onReset, delay); return () => clearTimeout(t); }, []);
  return null;
}

function BounceIn({ children }: { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function FadeSlideUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 320, delay, useNativeDriver: true }),
      Animated.timing(translateY,  { toValue: 0, duration: 320, delay, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/* ─── Scan Line animation ─── */
function ScanLine() {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: FRAME_SIZE - 4, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[s.scanLine, { transform: [{ translateY: y }] }]} />
  );
}

/* ─── Corner bracket pulse ─── */
function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const delay = { tl: 0, tr: 200, bl: 400, br: 600 }[position];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 700, useNativeDriver: true }),
        Animated.delay(400 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const pos: Record<string, object> = {
    tl: { top: 0,    left: 0,  borderTopWidth: 3,    borderLeftWidth: 3,    borderTopLeftRadius: 4 },
    tr: { top: 0,    right: 0, borderTopWidth: 3,    borderRightWidth: 3,   borderTopRightRadius: 4 },
    bl: { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,    borderBottomLeftRadius: 4 },
    br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3,   borderBottomRightRadius: 4 },
  };
  return <Animated.View style={[s.corner, pos[position], { opacity }]} />;
}

/* ─── Badge glow pulse ─── */
function GlowPill({ children, style }: { children: React.ReactNode; style?: object }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>;
}

/* ─── Loading ring ─── */
function LoadingRing() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[s.loadingRing, { transform: [{ rotate }] }]} />;
}

/* ─── Confetti ─── */
const CONFETTI_COLORS = ['#6366F1','#F59E0B','#10B981','#EC4899','#3B82F6','#F97316'];
function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 900 + (i % 4) * 200,
        delay: i * 80,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, []);
    const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 340] });
    const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i * 40}deg`] });
    const opacity = anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
    const size = 6 + (i % 3) * 3;
    return { anim, ty, rotate, opacity, size, color: CONFETTI_COLORS[i % 6], left: `${8 + (i * 5.2) % 85}%` };
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', top: 0, left: p.left as any,
          width: p.size, height: p.size, borderRadius: 2,
          backgroundColor: p.color,
          opacity: p.opacity,
          transform: [{ translateY: p.ty }, { rotate: p.rotate }],
        }} />
      ))}
    </View>
  );
}

/* ─── Camera zone ─── */
function CameraZone({ stage, onScanned }: { stage: Stage; onScanned: (d: { data: string }) => void }) {
  const isScanning = stage.name === 'scanning';
  const [permission, requestPermission] = useCameraPermissions();

  const stageIcon: Record<string, string> = {
    validating: '⏳', recording: '⏱',
    happy_journey: '🚇', thank_you: '🎊', denied: '🚫', error: '',
  };

  return (
    <View style={{ height: CAMERA_H, position: 'relative', overflow: 'hidden' }}>
      {/* Dark gradient bg */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="camGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0"   stopColor="#1a0533" />
              <Stop offset="0.4" stopColor="#0d1b4a" />
              <Stop offset="0.7" stopColor="#0a2a5e" />
              <Stop offset="1"   stopColor="#0e1a3a" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#camGrad)" />
          {/* Grid */}
          {Array.from({ length: Math.ceil(SCREEN_W / 32) + 1 }, (_, i) => (
            <Line key={`v${i}`} x1={i * 32} y1={0} x2={i * 32} y2={CAMERA_H}
              stroke="rgba(99,102,241,0.08)" strokeWidth="1" />
          ))}
          {Array.from({ length: Math.ceil(CAMERA_H / 32) + 1 }, (_, i) => (
            <Line key={`h${i}`} x1={0} y1={i * 32} x2={SCREEN_W} y2={i * 32}
              stroke="rgba(99,102,241,0.08)" strokeWidth="1" />
          ))}
        </Svg>
      </View>

      {/* Live camera feed when scanning */}
      {isScanning && permission?.granted && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={onScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
      )}

      {/* Overlay on camera */}
      {isScanning && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: FRAME_SIZE, height: FRAME_SIZE }}>
            <Corner position="tl" />
            <Corner position="tr" />
            <Corner position="bl" />
            <Corner position="br" />
            <ScanLine />
          </View>
          <Text style={s.camHint}>Point at SVP QR code</Text>
        </View>
      )}

      {/* Non-scanning icon */}
      {!isScanning && stageIcon[stage.name] && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
          <Text style={{ fontSize: 52 }}>{stageIcon[stage.name]}</Text>
          {(stage.name === 'validating' || stage.name === 'recording') && (
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500' }}>
              {stage.name === 'validating' ? 'Validating QR…' : 'Recording entry…'}
            </Text>
          )}
        </View>
      )}

      {/* Permission prompt */}
      {isScanning && !permission?.granted && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Camera permission required</Text>
          <TouchableOpacity style={s.ctaBtn} onPress={requestPermission}>
            <Text style={s.ctaBtnTxt}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ─── Station Picker ─── */
function StationPicker({ title, onSelect, onClose }: {
  title: string; onSelect: (s: GateStation) => void; onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.pickerSheet}>
        <View style={s.pickerHeader}>
          <Text style={s.pickerTitle}>{title}</Text>
          <TouchableOpacity style={s.pickerClose} onPress={onClose}>
            <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={STATIONS}
          keyExtractor={st => String(st.code)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const badgeStyle = item.line === 'Blue'  ? s.badgeBlue
                             : item.line === 'Green' ? s.badgeGreen
                             : s.badgeBoth;
            const badgeTxtStyle = item.line === 'Blue'  ? s.badgeBlueTxt
                                : item.line === 'Green' ? s.badgeGreenTxt
                                : s.badgeBothTxt;
            return (
              <TouchableOpacity style={s.stRow} onPress={() => onSelect(item)} activeOpacity={0.75}>
                <View>
                  <Text style={s.stName}>{item.name}</Text>
                  <View style={[s.badge, badgeStyle]}>
                    <Text style={[s.badgeTxt, badgeTxtStyle]}>
                      {item.line === 'Both' ? '● Blue  ● Green' : `● ${item.line} Line`}
                    </Text>
                  </View>
                </View>
                <Text style={s.stChev}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

/* ─── Data card row ─── */
function DataRow({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <View style={s.dataRow}>
      <Text style={s.dataLabel}>{label}</Text>
      <Text style={[s.dataValue, accent && s.dataAccent, mono && s.dataMono]} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

/* ─── Main screen ─── */
export default function ValidateScreen() {
  const [stage,        setStage]        = useState<Stage>({ name: 'scanning' });
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [pending,      setPending]      = useState<QRInfo | null>(null);
  const [isExitFlow,   setIsExitFlow]   = useState(false);
  const [entryStation, setEntryStation] = useState('');
  const lastScan = useRef<{ txnId: string; time: number } | null>(null);

  function reset() {
    setStage({ name: 'scanning' });
    setPickerOpen(false);
    setPending(null);
    setIsExitFlow(false);
    setEntryStation('');
  }

  async function onScanned({ data }: { data: string }) {
    if (stage.name !== 'scanning') return;
    setStage({ name: 'validating' });
    clearPublicKeyCache();
    try {
      const parsed = parseQRString(data);
      const ok     = await verify(parsed.plaintext, parsed.signature);
      if (!ok) throw new Error('Invalid QR signature');
      checkQRFreshness(parsed);
      const info = extractInfo(parsed);

      // Duplicate scan guard — same QR within 10 seconds
      const now = Date.now();
      if (lastScan.current?.txnId === info.txnId && now - lastScan.current.time < 10_000) {
        throw new Error('Already scanned — please wait before scanning again.');
      }
      lastScan.current = { txnId: info.txnId, time: now };

      const last = await getLastEvent(info.txnId);
      setPending(info);
      if (last?.event === 'entry') {
        setIsExitFlow(true);
        setEntryStation(last.station_name);
        setStage({ name: 'exit_info', info, entryStation: last.station_name });
      } else {
        setIsExitFlow(false);
        setStage({ name: 'entry_info', info });
      }
    } catch (e: unknown) {
      setStage({ name: 'error', message: (e as Error).message });
    }
  }

  async function onStationPicked(station: GateStation) {
    setPickerOpen(false);
    if (!pending) return;

    // Same station entry/exit guard
    if (isExitFlow && station.name === entryStation) {
      setStage({ name: 'error', message: `Exit station cannot be the same as entry station (${entryStation}). Please select a different station.` });
      return;
    }

    setStage({ name: 'recording' });
    try {
      const { allowed, reason } = await processGate(pending.txnId, pending.serial, pending.mobileNumber, station);
      if (!allowed) {
        setStage({ name: 'denied', reason: reason ?? 'Access denied by fare system.' });
      } else if (isExitFlow) {
        setStage({ name: 'thank_you', from: entryStation, to: station.name });
      } else {
        setStage({ name: 'happy_journey' });
      }
    } catch (e: unknown) {
      setStage({ name: 'error', message: (e as Error).message });
    }
  }

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>AFC Gate Validator</Text>
        <Text style={s.headerSub}>Chennai Metro Rail · CMRL</Text>
      </View>

      {/* Camera */}
      <CameraZone stage={stage} onScanned={onScanned} />

      {/* Panel */}
      <View style={s.panel}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.panelScroll}
          bounces={false}
        >

          {/* SCANNING */}
          {stage.name === 'scanning' && (
            <View style={s.centerCol}>
              <GlowPill style={s.readyPill}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={s.readyDot} />
                  <Text style={s.readyTxt}>READY TO SCAN</Text>
                </View>
              </GlowPill>
              <Text style={s.scanTitle}>AFC Gate Validator</Text>
              <Text style={s.scanSub}>Align the passenger's QR code{'\n'}within the frame above</Text>
            </View>
          )}

          {/* VALIDATING / RECORDING */}
          {(stage.name === 'validating' || stage.name === 'recording') && (
            <View style={[s.centerCol, { paddingTop: 24 }]}>
              <LoadingRing />
              <Text style={s.loadingTitle}>{stage.name === 'validating' ? 'Validating…' : 'Recording…'}</Text>
              <Text style={s.loadingSub}>{stage.name === 'validating' ? 'Checking QR signature' : 'Saving to server'}</Text>
            </View>
          )}

          {/* ENTRY INFO */}
          {stage.name === 'entry_info' && (
            <FadeSlideUp>
              <View style={s.infoWrap}>
                <View style={s.centerCol}>
                  <View style={s.validBadge}>
                    <Text style={s.validTxt}>✓  VALID TICKET</Text>
                  </View>
                  <Text style={s.balAmt}>{stage.info.balance}</Text>
                  <Text style={s.balLbl}>SVP Balance</Text>
                </View>
                <View style={s.dataCard}>
                  <DataRow label="Ticket ID" value={stage.info.txnId} mono />
                  <View style={s.sep} />
                  <DataRow label="Mobile" value={stage.info.mobile} />
                </View>
                <TouchableOpacity style={s.ctaBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
                  <Text style={s.ctaBtnTxt}>Choose Entry Station</Text>
                  <View style={s.ctaBtnArrow}><Text style={{ color: '#fff', fontSize: 14 }}>↗</Text></View>
                </TouchableOpacity>
              </View>
            </FadeSlideUp>
          )}

          {/* EXIT INFO */}
          {stage.name === 'exit_info' && (
            <FadeSlideUp>
              <View style={s.infoWrap}>
                <View style={s.centerCol}>
                  <View style={s.validBadge}>
                    <Text style={s.validTxt}>✓  VALID TICKET</Text>
                  </View>
                  <Text style={s.balAmt}>{stage.info.balance}</Text>
                  <Text style={s.balLbl}>SVP Balance</Text>
                </View>
                <View style={s.dataCard}>
                  <DataRow label="Ticket ID" value={stage.info.txnId} mono />
                  <View style={s.sep} />
                  <DataRow label="Mobile" value={stage.info.mobile} />
                  <View style={s.sep} />
                  <DataRow label="Entered At" value={stage.entryStation} accent />
                </View>
                <TouchableOpacity style={s.ctaBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
                  <Text style={s.ctaBtnTxt}>Choose Exit Station</Text>
                  <View style={s.ctaBtnArrow}><Text style={{ color: '#fff', fontSize: 14 }}>↗</Text></View>
                </TouchableOpacity>
              </View>
            </FadeSlideUp>
          )}

          {/* HAPPY JOURNEY */}
          {stage.name === 'happy_journey' && (
            <View style={[s.centerCol, { paddingTop: 12, gap: 10 }]}>
              <AutoReset onReset={reset} delay={3000} />
              <BounceIn>
                <View style={s.hjIconWrap}>
                  <Text style={{ fontSize: 48 }}>🚇</Text>
                </View>
              </BounceIn>
              <FadeSlideUp delay={200}>
                <View style={s.centerCol} pointerEvents="none">
                  <Text style={s.hjTitle}>Happy Journey!</Text>
                  <Text style={s.hjSub}>Entry recorded successfully</Text>
                  <View style={s.hjChip}>
                    <Text style={s.hjChipTxt}>● Boarding recorded</Text>
                  </View>
                  <Text style={s.autoResetTxt}>Auto-resetting in 3s…</Text>
                </View>
              </FadeSlideUp>
            </View>
          )}

          {/* THANK YOU */}
          {stage.name === 'thank_you' && (
            <View style={[s.centerCol, { paddingTop: 8, gap: 12 }]}>
              <AutoReset onReset={reset} delay={4000} />
              <Confetti />
              <BounceIn>
                <View style={s.tyIconWrap}>
                  <Text style={{ fontSize: 48 }}>🎉</Text>
                </View>
              </BounceIn>
              <FadeSlideUp delay={200}>
                <View style={s.centerCol} pointerEvents="none">
                  <Text style={s.tyTitle}>Thank You!</Text>
                  <Text style={s.hjSub}>Journey complete · Have a great day!</Text>
                </View>
              </FadeSlideUp>
              <FadeSlideUp delay={350}>
                <View style={[s.tripCard, { width: SCREEN_W - 40 }]} pointerEvents="none">
                  <View style={s.tripCol}>
                    <Text style={s.tripLbl}>BOARDED</Text>
                    <Text style={s.tripStation}>{stage.from}</Text>
                  </View>
                  <View style={s.tripArrow}>
                    <Text style={{ fontSize: 16, color: '#6366F1', fontWeight: '700' }}>→</Text>
                  </View>
                  <View style={s.tripCol}>
                    <Text style={s.tripLbl}>ALIGHTED</Text>
                    <Text style={s.tripStation}>{stage.to}</Text>
                  </View>
                </View>
              </FadeSlideUp>
              <Text style={s.autoResetTxt}>Auto-resetting in 4s…</Text>
            </View>
          )}

          {/* DENIED */}
          {stage.name === 'denied' && (
            <View style={[s.centerCol, { paddingTop: 12, gap: 12 }]}>
              <AutoReset onReset={reset} delay={4000} />
              <BounceIn>
                <View style={s.deniedIconWrap}>
                  <Text style={{ fontSize: 42 }}>🚫</Text>
                </View>
              </BounceIn>
              <FadeSlideUp delay={200}>
                <View style={s.centerCol} pointerEvents="none">
                  <Text style={s.deniedTitle}>Gate Closed</Text>
                  <Text style={s.errMsg}>{stage.reason}</Text>
                  <Text style={s.autoResetTxt}>Auto-resetting in 4s…</Text>
                </View>
              </FadeSlideUp>
            </View>
          )}

          {/* ERROR */}
          {stage.name === 'error' && (
            <View style={[s.centerCol, { paddingTop: 12, gap: 12 }]}>
              <BounceIn>
                <View style={s.errIconWrap}>
                  <Text style={{ fontSize: 42, color: '#EF4444', fontWeight: '900' }}>✕</Text>
                </View>
              </BounceIn>
              <Text style={s.errTitle}>Rejected</Text>
              <Text style={s.errMsg}>{stage.message}</Text>
              <TouchableOpacity style={s.errBtn} onPress={reset} activeOpacity={0.85}>
                <Text style={s.ctaBtnTxt}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>

      {/* Station picker */}
      {pickerOpen && (
        <StationPicker
          title={isExitFlow ? 'Exit Station' : 'Entry Station'}
          onSelect={onStationPicked}
          onClose={() => {
            setPickerOpen(false);
            setStage(isExitFlow
              ? { name: 'exit_info', info: pending!, entryStation }
              : { name: 'entry_info', info: pending! }
            );
          }}
        />
      )}

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#0f0c1e' },

  header:        { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle:   { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub:     { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1, fontWeight: '500' },

  camHint:       { position: 'absolute', bottom: 14, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },

  /* Scan frame corners */
  corner:        { position: 'absolute', width: 22, height: 22, borderColor: '#818CF8' },

  /* Animated scan line */
  scanLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: '#818CF8',
    shadowColor: '#818CF8', shadowOpacity: 0.7, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  /* Panel */
  panel:         { flex: 1, backgroundColor: '#F5F4FF', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, overflow: 'hidden' },
  panelScroll:   { padding: 20, paddingBottom: 32 },
  centerCol:     { alignItems: 'center', gap: 8 },

  /* Ready to Scan */
  readyPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 4 },
  readyDot:      { width: 7, height: 7, backgroundColor: '#6366F1', borderRadius: 4 },
  readyTxt:      { fontSize: 11, fontWeight: '800', color: '#6366F1', letterSpacing: 1 },
  scanTitle:     { fontSize: 24, fontWeight: '800', color: '#1e1b4b' },
  scanSub:       { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  /* Loading */
  loadingRing:   { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: 'rgba(99,102,241,0.15)', borderTopColor: '#6366F1' },
  loadingTitle:  { fontSize: 22, fontWeight: '800', color: '#1e1b4b', marginTop: 12 },
  loadingSub:    { fontSize: 13, color: '#94a3b8' },

  /* Info */
  infoWrap:      { gap: 14, width: '100%' },
  validBadge:    { backgroundColor: '#DCFCE7', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 16 },
  validTxt:      { fontSize: 12, fontWeight: '800', color: '#16A34A', letterSpacing: 0.8 },
  balAmt:        { fontSize: 64, fontWeight: '800', color: '#1e1b4b', letterSpacing: -3, lineHeight: 68 },
  balLbl:        { fontSize: 12, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.5, marginTop: -4 },

  dataCard:      { backgroundColor: '#fff', borderRadius: 18, shadowColor: '#6366F1', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sep:           { height: 1, backgroundColor: '#f1f0ff' },
  dataRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18 },
  dataLabel:     { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 },
  dataValue:     { fontSize: 13, fontWeight: '700', color: '#1e1b4b', maxWidth: '58%', textAlign: 'right' },
  dataAccent:    { color: '#6366F1', fontSize: 15, fontWeight: '800' },
  dataMono:      { fontFamily: 'monospace', fontSize: 11 },

  /* CTA */
  ctaBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4F46E5', borderRadius: 18, paddingVertical: 18, width: '100%', shadowColor: '#4F46E5', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  ctaBtnTxt:     { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  ctaBtnArrow:   { width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* Happy Journey */
  hjIconWrap:    { width: 90, height: 90, backgroundColor: '#ECFDF5', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  hjTitle:       { fontSize: 32, fontWeight: '800', color: '#1e1b4b' },
  hjSub:         { fontSize: 14, color: '#64748b', fontWeight: '500' },
  hjChip:        { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20, shadowColor: '#6366F1', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  hjChipTxt:     { fontSize: 15, fontWeight: '800', color: '#4F46E5' },
  autoResetTxt:  { fontSize: 12, color: '#94a3b8', marginTop: 4 },

  /* Thank You */
  tyIconWrap:    { width: 90, height: 90, backgroundColor: '#FFF7ED', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#FBBF24', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  tyTitle:       { fontSize: 32, fontWeight: '800', color: '#1e1b4b' },
  tripCard:      { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  tripCol:       { flex: 1, alignItems: 'center', gap: 4 },
  tripLbl:       { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' },
  tripStation:   { fontSize: 15, fontWeight: '800', color: '#1e1b4b', textAlign: 'center' },
  tripArrow:     { width: 36, height: 36, backgroundColor: '#EEF2FF', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8, flexShrink: 0 },

  /* Denied */
  deniedIconWrap: { width: 90, height: 90, backgroundColor: '#FFF7ED', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  deniedTitle:    { fontSize: 28, fontWeight: '800', color: '#EA580C' },

  /* Error */
  errIconWrap:   { width: 90, height: 90, backgroundColor: '#FEF2F2', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  errTitle:      { fontSize: 28, fontWeight: '800', color: '#EF4444' },
  errMsg:        { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
  errBtn:        { backgroundColor: '#EF4444', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 36, shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 4 },

  /* Picker */
  pickerSheet:   { flex: 1, backgroundColor: '#F5F4FF' },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  pickerTitle:   { fontSize: 18, fontWeight: '800', color: '#1e1b4b' },
  pickerClose:   { width: 32, height: 32, backgroundColor: '#e2e1f7', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  stName:        { fontSize: 14, fontWeight: '700', color: '#1e1b4b', marginBottom: 4 },
  stChev:        { fontSize: 24, color: '#cbd5e1' },
  badge:         { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'flex-start' },
  badgeTxt:      { fontSize: 10, fontWeight: '700' },
  badgeBlue:     { backgroundColor: '#DBEAFE' },
  badgeBlueTxt:  { color: '#1D4ED8' },
  badgeGreen:    { backgroundColor: '#DCFCE7' },
  badgeGreenTxt: { color: '#16A34A' },
  badgeBoth:     { backgroundColor: '#EEF2FF' },
  badgeBothTxt:  { color: '#6366F1' },
});
