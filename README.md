# Chennai One SVP — QR Generator, Verifier & AFC Gate Validator

A React Native (Expo) app serving two roles:
1. **Passenger app** — generates and verifies Store Value Pass (SVP) QR codes for Chennai Metro Rail (CMRL)
2. **AFC Gate Validator** — scans passenger QR codes at station gates, records entry/exit events, and notifies the fare computation system

## Features

- **Generate SVP QR** — builds a signed SQDSR-format QR code with balance, mobile number, and TXN reference
- **Auto-refresh** — QR refreshes on a configurable interval (TAG 84 dynamic data update) with a 10-minute session timeout
- **Verify QR** — scan or paste a QR payload and verify the RSA-2048/SHA-256 signature against the server public key
- **Payload Breakdown** — inspect every TAG/field in the QR dataset after generation or verification
- **AFC Gate Validator** — validates QR at entry/exit, records events to Supabase, and pushes trip data to the fare computation API

## AFC Gate Flow

This app acts as the Automatic Fare Collection (AFC) gate controller at each metro station. The flow is:

```
Passenger presents QR
        │
        ▼
[AFC App] Validate QR signature + freshness
        │
        ▼
[AFC App] Extract mobileNumber from QR (last field in SVC/TAG83 block)
        │
        ▼
[AFC App] POST to Fare API → { mobileNumber, stationCode, scanType: ENTRY/EXIT, timestamp }
        │
        ├── allowed: false → Show denial reason, gate stays closed
        │
        └── allowed: true  → Record event in Supabase, gate opens
```

### Entry scan
- AFC calls the fare API with `scanType: ENTRY` and the station code
- Fare API checks wallet balance (minimum ₹50 required) and returns `allowed`
- On approval: event recorded in Supabase, "Happy Journey" shown

### Exit scan
- AFC calls the fare API with `scanType: EXIT` and the exit station code
- Fare API computes trip fare (entry→exit), deducts from wallet, returns `allowed`
- On approval: trip summary shown with boarded/alighted stations

### Gate decision source
The gate open/close decision is **owned entirely by the fare API**. The AFC app is a thin validator and pusher — it does not compute fare or manage balances. Supabase records are the audit trail; the fare API response is the gate authority.

### Validation checks (AFC-side, before API call)
| Check | Behaviour |
|---|---|
| QR signature invalid | Blocked — invalid ticket |
| QR older than 30 seconds | Blocked — expired QR |
| Same QR scanned within 10 seconds | Blocked — duplicate scan warning |
| Exit station = Entry station | Blocked — same station warning |

### Fare API
```
POST https://api.sandbox.moving.tech/dev/app/v2/svp/gate
{
  "mobileNumber": "8264990512",
  "merchantId":   "da4e23a5-3ce6-4c37-8b9b-41377c3c1a51",
  "stationCode":  "SCC|0201",
  "timestamp":    "2026-04-29T10:00:00Z",
  "scanType":     "ENTRY" | "EXIT"
}

Response:
{ "allowed": true,  "reason": null }
{ "allowed": false, "reason": "Insufficient balance. Minimum ₹50 required." }
```

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React Native + Expo (SDK 54) |
| Navigation | expo-router (file-based tabs) |
| QR Generation | react-native-qrcode-svg |
| QR Scanning | expo-camera |
| Crypto (verify) | node-forge |
| Crypto (sign) | react-native-quick-crypto |
| Storage | react-native-mmkv |

## QR Format

Payloads follow the SQDSR structure:

```
{TAG81|TAG82|TAG83_fields}|{TAG84_fields}|{(TAG85_header|[TAG85_ticket_fields])}|{SIG:base64}
```

- **TAG 81** — Security scheme (`0x03` = RSA-2048 + SHA-256)
- **TAG 82** — Dataset version (`0x04`)
- **TAG 83** — Common data: TG ID, serial, datetime, TXN ref, mobile (62 bytes)
- **TAG 84** — Dynamic data: QR status, SVP balance, updated timestamp (32 bytes)
- **TAG 85** — Ticket block: product, stations, validity, fare, account ID
- **SIG** — RSA-2048/SHA-256 signature (Base64), fetched from the signing API

## Signing & Verification

Signing is done server-side via Firebase Cloud Functions:

- `POST https://svp-qr-generator.web.app/api/signQR` — signs the plaintext payload
- `GET https://svp-qr-generator.web.app/api/public-key` — returns the RSA public key PEM

The app verifies locally using the fetched public key (cached per scan).

## Getting Started

### Prerequisites

- Node.js 18+
- Java 17 (for Android builds)
- Android SDK / ADB (for device installs)

### Install dependencies

```bash
npm install
```

### Build release APK (standalone, no Metro needed)

```bash
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

The release APK bundles the JS — no Metro bundler required on the device.

### Build debug APK

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
# Debug builds need Metro running on the same machine:
adb reverse tcp:8081 tcp:8081 && npx expo start
```

## Project Structure

```
app/
  (tabs)/
    index.tsx           # AFC Gate Validator screen (main scan + entry/exit flow)
    gate.tsx            # Gate scanner tab (alternate scanner UI)
    verify.tsx          # Verify QR screen (manual inspection)
    events.tsx          # Event log screen (Supabase audit trail)
    settings.tsx        # Settings screen
    _layout.tsx         # Tab navigator
  _layout.tsx           # Root layout

src/
  components/
    GateScanner.tsx     # Camera scanner component used by gate tab
    SVPForm.tsx         # Input form (balance, mobile, TXN ref, refresh interval)
    QRDisplay.tsx       # QR code display with countdown ring
    QRVerifier.tsx      # Camera scanner + manual paste + result summary
    PayloadBreakdown.tsx # Collapsible TAG field inspector
  lib/
    crypto.ts           # sign() and verify() via API / node-forge
    dataset.ts          # Build SQDSR dataset from form values
    sqdsr.ts            # Serialise dataset to pipe-delimited string
    parser.ts           # Parse raw QR string back into dataset fields
    validator.ts        # Field validation helpers
    gate.ts             # Gate logic: processGate(), validation checks, fare API call
    supabase.ts         # Supabase REST client: insertEvent(), getLastEvent(), fetchEvents()
  constants/
    spec.ts             # TAG constants, field sizes, SVP defaults
    stations.ts         # CMRL station codes, stationCode mappings, operator constants
  config.ts             # API base URL
```

## SVP Defaults

| Parameter | Value |
|---|---|
| Validity | 480 minutes (8 hours) |
| Journey duration | 180 minutes |
| Min balance | ₹50 |
| Security scheme | RSA-2048 / SHA-256 |
| TG ID | CMRL (`0x0001`) |
