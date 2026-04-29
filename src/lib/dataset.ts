import {
  SECURITY_SCHEME, DATASET_VERSION, TXN_TYPE, QR_STATE,
  LANG, COMMON_DATA_FIELDS, SVP_DEFAULTS,
} from '../constants/spec';
import { CMRL } from '../constants/stations';

export function toHex(value: number, bytes: number): string {
  return (value >>> 0).toString(16).toUpperCase().padStart(bytes * 2, '0');
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function padR(s: string | number | undefined, n: number): string {
  return String(s ?? '').padEnd(n, '0').slice(0, n);
}

function padMobile(s: string | number | undefined, n: number): string {
  return String(s ?? '').replace(/\D/g, '').padStart(n, '0').slice(0, n);
}

export function makeSerialNo(): string {
  const dtHex  = toHex(nowSec(), 4);
  const seq    = Math.floor(Math.random() * 1_073_741_823) + 1;
  const seqWord = (0x40000000 | seq) >>> 0;
  return dtHex + toHex(seqWord, 4);
}

export function serialDisplay(hexStr: string): string {
  const dtSec  = parseInt(hexStr.slice(0, 8), 16);
  const d      = new Date(dtSec * 1000);
  const p2     = (n: number) => String(n).padStart(2, '0');
  const seqRaw = parseInt(hexStr.slice(8), 16) & 0x3FFFFFFF;
  return (
    `${p2(d.getDate())}${p2(d.getMonth() + 1)}${d.getFullYear()}` +
    `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}` +
    `M${String(seqRaw).padStart(10, '0')}`
  );
}

export function buildSecurity() {
  const hex = toHex(SECURITY_SCHEME.RSA_SIGN, 1);
  return {
    tag: '81', label: 'QR Security', totalBytes: 1, hex,
    fields: [{
      name: 'Security Scheme', size: COMMON_DATA_FIELDS.LANGUAGE, hex,
      desc: 'Scheme 0x03 — RSA-2048 + SHA-256 digital signing, no encryption',
    }],
  };
}

export function buildVersion() {
  const hex = toHex(DATASET_VERSION, 1);
  return {
    tag: '82', label: 'QR Dataset Version', totalBytes: 1, hex,
    fields: [{ name: 'Version', size: 1, hex, desc: 'v1.0 → 0x04' }],
  };
}

export function buildCommonData({ txnRef, mobile }: { txnRef: string; mobile: string }) {
  const serial = makeSerialNo();
  const genDt  = nowSec();

  const fields = [
    { name: 'Language',              size: 1,  hex: toHex(LANG.ENGLISH, 1),         desc: '0x00 = English' },
    { name: 'TG ID',                 size: 2,  hex: toHex(CMRL.TG_ID, 2),           desc: `CMRL (0x${toHex(CMRL.TG_ID, 2)})` },
    { name: 'Transaction Type',      size: 1,  hex: toHex(TXN_TYPE.PURCHASE, 1),    desc: '0x41 = QR Purchase' },
    { name: 'Ticket Serial No',      size: 8,  hex: serial,                          desc: `Display: ${serialDisplay(serial)}` },
    { name: 'QR Gen Datetime',       size: 4,  hex: toHex(genDt, 4),                desc: `Unix ${genDt}` },
    { name: 'Requester ID (App ID)', size: 4,  hex: toHex(1, 4),                    desc: 'App ID = 0x00000001 (mobile client)' },
    { name: 'TXN Ref No',            size: 22, hex: padR(txnRef, 22),               desc: '22-char payment reference' },
    { name: 'Total Fare',            size: 4,  hex: toHex(0, 4),                    desc: 'SVP — fare determined at exit' },
    { name: 'Booking Latitude',      size: 3,  hex: toHex(0, 3),                    desc: 'Not provided' },
    { name: 'Booking Longitude',     size: 3,  hex: toHex(0, 3),                    desc: 'Not provided' },
    { name: 'Mobile',                size: 10, hex: padMobile(mobile, 10),          desc: `Customer mobile: ${mobile}` },
  ];

  const byteSum = fields.reduce((a, f) => a + f.size, 0);
  if (byteSum !== 62) throw new Error(`Common Data byte sum ${byteSum} ≠ 62`);

  return { tag: '83', label: 'QR Common Data', totalBytes: 62, fields, serial, genDt };
}

export function buildDynamicData({ svpBalancePaisa }: { svpBalancePaisa: number }) {
  const qrStatus = toHex(CMRL.OPERATOR_ID, 2) + toHex((1 << 4) | QR_STATE.ACTIVE, 1);
  const opDyn    = toHex(svpBalancePaisa, 4) + toHex(0, 15);

  const fields = [
    { name: 'QR Updated Time',          size: 4,  hex: toHex(nowSec(), 4), desc: 'Current unix timestamp' },
    { name: 'QR Status',                size: 3,  hex: qrStatus,           desc: `Operator 0x${toHex(CMRL.OPERATOR_ID, 2)} | State=Active` },
    { name: 'Latitude',                 size: 3,  hex: toHex(0, 3),        desc: 'Not used' },
    { name: 'Longitude',                size: 3,  hex: toHex(0, 3),        desc: 'Not used' },
    { name: 'Op-specific Dynamic Data', size: 19, hex: opDyn,              desc: `SVP Balance: ₹${svpBalancePaisa / 100}` },
  ];

  const byteSum = fields.reduce((a, f) => a + f.size, 0);
  if (byteSum !== 32) throw new Error(`Dynamic Data byte sum ${byteSum} ≠ 32`);

  return { tag: '84', label: 'QR Dynamic Data', totalBytes: 32, fields };
}

function buildTicket({ svpBalancePaisa, svpAccountId }: { svpBalancePaisa: number; svpAccountId: number }) {
  const actDt     = nowSec();
  const opTktData = toHex(svpBalancePaisa, 4) + toHex(svpAccountId & 0xFFFFFFFF, 4);

  const fields = [
    { name: 'Group Size',              size: 1,  hex: toHex(1, 1),                       desc: 'Single passenger' },
    { name: 'Source Station',          size: 2,  hex: toHex(CMRL.ANY_STATION, 2),        desc: 'ANY (0x0000)' },
    { name: 'Destination Station',     size: 2,  hex: toHex(CMRL.ANY_STATION, 2),        desc: 'ANY (0x0000)' },
    { name: 'Activation Datetime',     size: 4,  hex: toHex(actDt, 4),                   desc: new Date(actDt * 1000).toUTCString() },
    { name: 'Product ID',              size: 2,  hex: toHex(CMRL.PRODUCT_SVP, 2),        desc: `0x${toHex(CMRL.PRODUCT_SVP, 2)} = SVP` },
    { name: 'Service ID',              size: 1,  hex: toHex(CMRL.SERVICE_ID, 1),         desc: '0x01 = Metro Rail' },
    { name: 'Ticket Fare',             size: 4,  hex: toHex(0, 4),                       desc: 'SVP — deducted at exit' },
    { name: 'Validity',                size: 2,  hex: toHex(SVP_DEFAULTS.VALIDITY_MINS, 2), desc: `${SVP_DEFAULTS.VALIDITY_MINS} min = 8 hrs` },
    { name: 'Duration',                size: 2,  hex: toHex(SVP_DEFAULTS.DURATION_MINS, 2), desc: `${SVP_DEFAULTS.DURATION_MINS} min max timeout` },
    { name: 'Op-specific Ticket Data', size: 8,  hex: opTktData,                         desc: `Balance: ₹${svpBalancePaisa / 100}` },
  ];

  const byteSum = fields.reduce((a, f) => a + f.size, 0);
  if (byteSum !== 28) throw new Error(`Ticket byte sum ${byteSum} ≠ 28`);

  return fields;
}

export function buildTicketBlock(params: { svpBalancePaisa: number; svpAccountId: number }) {
  return {
    tag: '85', label: 'QR Ticket Block — Dynamic Block',
    opId:    toHex(CMRL.OPERATOR_ID, 2),
    noTkts:  toHex(1, 1),
    valInfo: toHex(0x10, 1),
    ticket:  buildTicket(params),
  };
}

export function refreshDataset(existingDataset: ReturnType<typeof buildDataset>, svpBalancePaisa: number) {
  return { ...existingDataset, dynamicData: buildDynamicData({ svpBalancePaisa }) };
}

export function buildDataset(formValues: { balanceRupees: number; mobile: string; txnRef: string }) {
  const { balanceRupees, mobile, txnRef } = formValues;
  const svpBalancePaisa = balanceRupees * 100;
  const svpAccountId    = Math.floor(Math.random() * 0xFFFF) + 1;
  const params          = { svpBalancePaisa, svpAccountId, mobile, txnRef };

  return {
    security:    buildSecurity(),
    version:     buildVersion(),
    commonData:  buildCommonData(params),
    dynamicData: buildDynamicData(params),
    ticketBlock: buildTicketBlock(params),
  };
}
