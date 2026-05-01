import {
  SECURITY_SCHEME, DATASET_VERSION, TXN_TYPE, QR_STATE, LANG, SVP_DEFAULTS,
} from '../constants/spec';
import { CMRL } from '../constants/stations';
import { toHex } from './dataset';
import { verify } from './crypto';
import type { ParsedQR } from './parser';

export interface CheckResult {
  id: string;
  section: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
}

function pass(id: string, section: string, description: string, detail = ''): CheckResult {
  return { id, section, description, status: 'PASS', detail };
}
function fail(id: string, section: string, description: string, detail = ''): CheckResult {
  return { id, section, description, status: 'FAIL', detail };
}
function warn(id: string, section: string, description: string, detail = ''): CheckResult {
  return { id, section, description, status: 'WARN', detail };
}

export async function validatePayload(result: ParsedQR): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const { dataset, plaintext, signature, finalPayload } = result;
  const { security, version, commonData, dynamicData, ticketBlock } = dataset;

  const secByte = parseInt(security.fields[0].hex, 16);
  checks.push(
    secByte === SECURITY_SCHEME.RSA_SIGN
      ? pass('S01', 'TAG 81 §5.1', 'Security scheme = 0x03 (RSA-2048 + SHA-256)', `Hex: ${security.fields[0].hex}`)
      : fail('S01', 'TAG 81 §5.1', 'Security scheme must be 0x03', `Got: 0x${security.fields[0].hex}`)
  );

  const verByte = parseInt(version.fields[0].hex, 16);
  checks.push(
    verByte === DATASET_VERSION
      ? pass('V01', 'TAG 82 §5.2', 'Dataset version = 0x04 (v1.0)', `Hex: ${version.fields[0].hex}`)
      : fail('V01', 'TAG 82 §5.2', 'Dataset version must be 0x04', `Got: 0x${version.fields[0].hex}`)
  );

  const cdBytes = commonData.fields.reduce((a: number, f: { size: number }) => a + f.size, 0);
  checks.push(
    cdBytes === 62
      ? pass('C01', 'TAG 83 §5.3', 'Common Data total = 62 bytes', `Sum: ${cdBytes}`)
      : fail('C01', 'TAG 83 §5.3', 'Common Data must be 62 bytes', `Got: ${cdBytes}`)
  );

  const langByte = parseInt(commonData.fields.find((f: { name: string }) => f.name === 'Language')?.hex ?? 'FF', 16);
  checks.push(
    langByte === LANG.ENGLISH
      ? pass('C02', 'TAG 83 §5.3', 'Language = 0x00 (English)', `Hex: ${toHex(langByte, 1)}`)
      : fail('C02', 'TAG 83 §5.3', `Language must be 0x00`, `Got: 0x${toHex(langByte, 1)}`)
  );

  const tgHex = commonData.fields.find((f: { name: string }) => f.name === 'TG ID')?.hex;
  checks.push(
    tgHex === toHex(CMRL.TG_ID, 2)
      ? pass('C03', 'TAG 83 §5.3', `TG ID = 0x${toHex(CMRL.TG_ID, 2)} (CMRL)`, `Hex: ${tgHex}`)
      : fail('C03', 'TAG 83 §5.3', 'TG ID mismatch', `Expected 0x${toHex(CMRL.TG_ID, 2)}, got 0x${tgHex}`)
  );

  const txnHex = commonData.fields.find((f: { name: string }) => f.name === 'Transaction Type')?.hex;
  checks.push(
    parseInt(txnHex ?? 'FF', 16) === TXN_TYPE.PURCHASE
      ? pass('C04', 'TAG 83 Table 4.1', 'TXN Type = 0x41 (QR Purchase)', `Hex: ${txnHex}`)
      : fail('C04', 'TAG 83 Table 4.1', 'TXN Type must be 0x41', `Got: 0x${txnHex}`)
  );

  const serialHex = commonData.fields.find((f: { name: string }) => f.name === 'Ticket Serial No')?.hex ?? '';
  checks.push(
    serialHex.length === 16
      ? pass('C05', 'TAG 83 §4', 'Serial No = 8 bytes', serialHex)
      : fail('C05', 'TAG 83 §4', 'Serial No must be 8 bytes', `Got ${serialHex.length / 2} bytes`)
  );

  const seqWord = parseInt(serialHex.slice(8), 16);
  const srcBits = (seqWord >>> 30) & 0x3;
  checks.push(
    srcBits === 0b01
      ? pass('C06', 'TAG 83 §4', 'Serial QR source = 01 (Mobile)', `Bits 31-30: ${srcBits.toString(2).padStart(2, '0')}`)
      : warn('C06', 'TAG 83 §4', `Serial QR source bits = ${srcBits.toString(2).padStart(2, '0')} (expected 01)`, 'Expected 01 for Mobile app')
  );

  const txnRef = commonData.fields.find((f: { name: string }) => f.name === 'TXN Ref No')?.hex ?? '';
  checks.push(
    txnRef.length === 22
      ? pass('C07', 'TAG 83 §5.3', 'TXN Ref No = 22 chars', txnRef)
      : fail('C07', 'TAG 83 §5.3', 'TXN Ref No must be 22 chars', `Got: ${txnRef.length}`)
  );

  const mobileHex = commonData.fields.find((f: { name: string }) => f.name === 'Mobile')?.hex ?? '';
  checks.push(
    mobileHex.length === 10
      ? pass('C08', 'TAG 83 §5.3', 'Mobile = 10 digits', mobileHex)
      : fail('C08', 'TAG 83 §5.3', 'Mobile must be 10 chars', `Got: ${mobileHex.length}`)
  );

  const ddBytes = dynamicData.fields.reduce((a: number, f: { size: number }) => a + f.size, 0);
  checks.push(
    ddBytes === 32
      ? pass('D01', 'TAG 84 §5.4', 'Dynamic Data total = 32 bytes', `Sum: ${ddBytes}`)
      : fail('D01', 'TAG 84 §5.4', 'Dynamic Data must be 32 bytes', `Got: ${ddBytes}`)
  );

  const qrStatusHex = dynamicData.fields.find((f: { name: string }) => f.name === 'QR Status')?.hex ?? '';
  const qrStateByte = parseInt(qrStatusHex.slice(4), 16) & 0x0F;
  checks.push(
    qrStateByte === QR_STATE.ACTIVE
      ? pass('D02', 'TAG 84 Table 5.6', 'QR State = 1 (Active)', `Status: ${qrStatusHex}`)
      : fail('D02', 'TAG 84 Table 5.6', 'QR State must be 1 (Active)', `Got: ${qrStateByte}`)
  );

  const opDynHex = dynamicData.fields.find((f: { name: string }) => f.name === 'Op-specific Dynamic Data')?.hex ?? '';
  const balanceRs = parseInt(opDynHex.slice(0, 8), 16);
  checks.push(
    balanceRs >= SVP_DEFAULTS.MIN_BALANCE
      ? pass('D03', 'TAG 84 + Business Rule', `SVP balance ≥ ₹50 (₹${balanceRs})`, `Balance: ₹${balanceRs}`)
      : fail('D03', 'TAG 84 + Business Rule', 'SVP balance below ₹50 minimum', `Balance: ₹${balanceRs}`)
  );

  const opIdHex = ticketBlock.opId;
  checks.push(
    opIdHex === toHex(CMRL.OPERATOR_ID, 2)
      ? pass('T01', 'TAG 85 §5.5', `Operator ID = 0x${toHex(CMRL.OPERATOR_ID, 2)} (CMRL)`, `Hex: ${opIdHex}`)
      : fail('T01', 'TAG 85 §5.5', 'Operator ID mismatch', `Expected 0x${toHex(CMRL.OPERATOR_ID, 2)}, got 0x${opIdHex}`)
  );

  const noTkts = parseInt(ticketBlock.noTkts, 16);
  checks.push(
    noTkts === 1
      ? pass('T02', 'TAG 85 §5.5', 'No of Tickets = 1', `Hex: ${ticketBlock.noTkts}`)
      : warn('T02', 'TAG 85 §5.5', `No of Tickets = ${noTkts} (expected 1 for SVP)`, `Hex: ${ticketBlock.noTkts}`)
  );

  const valInfoByte = parseInt(ticketBlock.valInfo, 16);
  const msn = (valInfoByte >> 4) & 0x0F;
  checks.push(
    msn >= 1
      ? pass('T03', 'TAG 85 Table 5.10', `Validator Info MSN = 0x${msn.toString(16).toUpperCase()}`, `Byte: 0x${ticketBlock.valInfo}`)
      : fail('T03', 'TAG 85 Table 5.10', 'Validator Info MSN must have ≥ 1 scanner capability bit', 'Camera (Bit4) or Laser (Bit5) required')
  );

  const encBit = valInfoByte & 0x01;
  checks.push(
    encBit === 0
      ? pass('T04', 'TAG 85 Table 5.10', 'Encryption bit = 0 (not encrypted)', 'Correct for Scheme 0x03')
      : fail('T04', 'TAG 85 Table 5.10', 'Encryption bit must be 0 for Scheme 0x03', '')
  );

  const tktBytes = ticketBlock.ticket.reduce((a: number, f: { size: number }) => a + f.size, 0);
  checks.push(
    tktBytes === 28
      ? pass('T05', 'TAG 85 Table 5.11', 'Ticket Info = 28 bytes', `Sum: ${tktBytes}`)
      : fail('T05', 'TAG 85 Table 5.11', 'Ticket Info must be 28 bytes', `Got: ${tktBytes}`)
  );

  const prodHex = ticketBlock.ticket.find((f: { name: string }) => f.name === 'Product ID')?.hex;
  checks.push(
    prodHex === toHex(CMRL.PRODUCT_SVP, 2)
      ? pass('T07', 'TAG 85 §5.5', `Product ID = 0x${toHex(CMRL.PRODUCT_SVP, 2)} (SVP)`, `Hex: ${prodHex}`)
      : fail('T07', 'TAG 85 §5.5', 'Product ID must be SVP (0x0005)', `Got: 0x${prodHex}`)
  );

  const validityHex = ticketBlock.ticket.find((f: { name: string }) => f.name === 'Validity')?.hex;
  const validityMins = parseInt(validityHex ?? '0', 16);
  checks.push(
    validityMins === SVP_DEFAULTS.VALIDITY_MINS
      ? pass('T08', 'TAG 85 §5.5', `Validity = ${validityMins} min (8 hours)`, `Hex: ${validityHex}`)
      : warn('T08', 'TAG 85 §5.5', `Validity = ${validityMins} min (expected ${SVP_DEFAULTS.VALIDITY_MINS})`, `Hex: ${validityHex}`)
  );

  checks.push(
    finalPayload.includes('|{SIG:')
      ? pass('F03', 'Part II §5', 'Final payload contains |{SIG:…}', `Tail: …${finalPayload.slice(-20)}`)
      : fail('F03', 'Part II §5', 'Signature block |{SIG:…} missing')
  );

  try {
    const valid = await verify(plaintext, signature);
    checks.push(
      valid
        ? pass('SIG1', 'Part II §5 RSA-2048', 'Signature verified (RSASSA-PKCS1-v1_5 / SHA-256)', '')
        : fail('SIG1', 'Part II §5 RSA-2048', 'Signature verification FAILED', 'RSA signature does not match plaintext')
    );
  } catch (e: unknown) {
    checks.push(fail('SIG1', 'Part II §5 RSA-2048', 'Signature verification threw an error', (e as Error).message));
  }

  checks.push(
    signature.length >= 340 && signature.length <= 348
      ? pass('SIG2', 'Part II §5', `Signature length = ${signature.length} chars (RSA-2048 ≈ 344)`)
      : warn('SIG2', 'Part II §5', `Signature length = ${signature.length} (expected ~344)`)
  );

  return checks;
}

export function summarise(checks: CheckResult[]) {
  return {
    total:  checks.length,
    passed: checks.filter(c => c.status === 'PASS').length,
    failed: checks.filter(c => c.status === 'FAIL').length,
    warned: checks.filter(c => c.status === 'WARN').length,
  };
}
