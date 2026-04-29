import { insertEvent, getLastEvent } from './supabase';
import { MMKV } from 'react-native-mmkv';

const STATION_KEY = 'gate_station';

function getStorage() {
  return new MMKV();
}

export interface GateStation { code: number; name: string; stationCode: string; }

export function getSavedStation(): GateStation | null {
  const raw = getStorage().getString(STATION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveStation(s: GateStation) {
  getStorage().set(STATION_KEY, JSON.stringify(s));
}

export type EventType = 'entry' | 'exit';

export interface GateEvent {
  txn_id:       string;
  event:        EventType;
  station_code: number;
  station_name: string;
  timestamp:    string;
  raw_serial:   string;
}

const QR_MAX_AGE_SECS = 30;

const FARE_API_URL = 'https://api.sandbox.moving.tech/dev/app/v2/svp/gate';
const MERCHANT_ID  = 'da4e23a5-3ce6-4c37-8b9b-41377c3c1a51';

export function checkQRFreshness(parsed: { dataset: { dynamicData: { fields: { name: string; hex: string }[] } } }): void {
  const updatedHex = parsed.dataset.dynamicData.fields.find(f => f.name === 'QR Updated Time')?.hex;
  if (!updatedHex) throw new Error('QR timestamp missing');
  const ageSecs = Math.floor(Date.now() / 1000) - parseInt(updatedHex, 16);
  if (ageSecs > QR_MAX_AGE_SECS) throw new Error(`QR expired — ${ageSecs}s old (max ${QR_MAX_AGE_SECS}s)`);
  if (ageSecs < 0) throw new Error('QR timestamp is in the future');
}

export function extractMobileNumber(mobileHex: string): string {
  return parseInt(mobileHex, 16).toString();
}

async function pushToFareAPI(
  mobileNumber: string,
  stationCode:  string,
  scanType:     'ENTRY' | 'EXIT',
  timestamp:    string,
): Promise<{ allowed: boolean; reason: string | null }> {
  const res = await fetch(FARE_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ mobileNumber, merchantId: MERCHANT_ID, stationCode, timestamp, scanType }),
  });
  if (!res.ok) throw new Error(`Fare API error ${res.status}`);
  return res.json();
}

export async function processGate(
  txnId:        string,
  rawSerial:    string,
  mobileNumber: string,
  station:      GateStation,
): Promise<{ type: EventType; allowed: boolean; reason: string | null }> {
  const last      = await getLastEvent(txnId);
  const eventType: EventType = (!last || last.event === 'exit') ? 'entry' : 'exit';
  const timestamp = new Date().toISOString();

  const fareResult = await pushToFareAPI(
    mobileNumber,
    station.stationCode,
    eventType === 'entry' ? 'ENTRY' : 'EXIT',
    timestamp,
  );

  if (fareResult.allowed) {
    await insertEvent({
      txn_id:       txnId,
      event:        eventType,
      station_code: station.code,
      station_name: station.name,
      timestamp,
      raw_serial:   rawSerial,
      mobile:       mobileNumber,
    });
  }

  return { type: eventType, allowed: fareResult.allowed, reason: fareResult.reason };
}

export function extractTxnId(parsed: { dataset: { commonData: { fields: { name: string; hex: string }[] } } }): string {
  return parsed.dataset.commonData.fields.find(f => f.name === 'Ticket Serial No')?.hex ?? 'UNKNOWN';
}
