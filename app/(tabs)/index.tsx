import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, Text, View, StyleSheet, SafeAreaView } from 'react-native';
import SVPForm, { FormValues } from '@/components/SVPForm';
import QRDisplay from '@/components/QRDisplay';
import PayloadBreakdown from '@/components/PayloadBreakdown';
import { buildDataset, refreshDataset } from '@/lib/dataset';
import { serialise, assembleFinal } from '@/lib/sqdsr';
import { sign } from '@/lib/crypto';

const DEFAULT_FORM: FormValues = {
  balanceRupees: '500',
  mobile:        '9876543210',
  txnRef:        'UPI20260415123456789012',
  refreshSecs:   '30',
};

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

type GenerateResult = {
  dataset:      ReturnType<typeof buildDataset>;
  plaintext:    string;
  signature:    string;
  finalPayload: string;
};

export default function GenerateScreen() {
  const [form,           setForm]           = useState<FormValues>(DEFAULT_FORM);
  const [result,         setResult]         = useState<GenerateResult | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [countdown,      setCountdown]      = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);

  const resultRef         = useRef<GenerateResult | null>(null);
  const formRef           = useRef(form);
  const sessionExpiredRef = useRef(false);
  const sessionStartRef   = useRef(0);

  useEffect(() => { resultRef.current        = result;        }, [result]);
  useEffect(() => { formRef.current          = form;          }, [form]);
  useEffect(() => { sessionExpiredRef.current = sessionExpired; }, [sessionExpired]);

  const serial = result?.dataset?.commonData?.serial;
  useEffect(() => {
    if (!serial) { setCountdown(0); return; }
    const secs = Math.max(5, Number(formRef.current.refreshSecs) || 30);
    setCountdown(secs);
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [serial]);

  useEffect(() => {
    if (countdown <= 0 && resultRef.current && !loading && !sessionExpiredRef.current) {
      doRefresh();
    }
  }, [countdown]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSessionExpired(false);
    sessionStartRef.current = Date.now();
    try {
      const dataset      = buildDataset({ ...form, balanceRupees: Number(form.balanceRupees) });
      const plaintext    = serialise(dataset);
      const signature    = await sign(plaintext);
      const finalPayload = assembleFinal(plaintext, signature);
      setResult({ dataset, plaintext, signature, finalPayload });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    sessionStartRef.current = Date.now();
    setSessionExpired(false);
    await doRefresh();
  }

  async function doRefresh() {
    const prev = resultRef.current;
    const f    = formRef.current;
    if (!prev) return;

    if (Date.now() - sessionStartRef.current > SESSION_TIMEOUT_MS) {
      setSessionExpired(true);
      return;
    }

    try {
      const svpBalancePaisa = Number(f.balanceRupees) * 100;
      const dataset         = refreshDataset(prev.dataset, svpBalancePaisa);
      const plaintext       = serialise(dataset);
      const signature       = await sign(plaintext);
      const finalPayload    = assembleFinal(plaintext, signature);
      setResult({ dataset, plaintext, signature, finalPayload });
      setCountdown(Math.max(5, Number(f.refreshSecs) || 30));
    } catch (e) {
      console.error('QR refresh failed:', e);
    }
  }

  const refreshSecs = Math.max(5, Number(form.refreshSecs) || 30);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <SVPForm
          values={form}
          onChange={setForm}
          onGenerate={handleGenerate}
          loading={loading}
        />

        <QRDisplay
          result={result}
          countdown={countdown}
          refreshSecs={refreshSecs}
          sessionExpired={sessionExpired}
          onResume={handleResume}
          loading={loading}
        />

        {result && <PayloadBreakdown result={result} defaultOpen={false} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#f8fafc' },
  scroll:      { flex: 1 },
  content:     { padding: 16, paddingBottom: 40 },
  errorBanner: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#fca5a5' },
  errorText:   { color: '#dc2626', fontSize: 13 },
});
