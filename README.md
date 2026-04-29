# Chennai One SVP — QR Generator & Verifier

A React Native (Expo) app for generating and verifying **Store Value Pass (SVP)** QR codes for the Chennai Metro Rail (CMRL) AFC system.

## Features

- **Generate SVP QR** — builds a signed SQDSR-format QR code with balance, mobile number, and TXN reference
- **Auto-refresh** — QR refreshes on a configurable interval (TAG 84 dynamic data update) with a 10-minute session timeout
- **Verify QR** — scan or paste a QR payload and verify the RSA-2048/SHA-256 signature against the server public key
- **Payload Breakdown** — inspect every TAG/field in the QR dataset after generation or verification

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
    index.tsx           # Generate QR screen
    verify.tsx          # Verify QR screen
    _layout.tsx         # Tab navigator
  _layout.tsx           # Root layout

src/
  components/
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
  constants/
    spec.ts             # TAG constants, field sizes, SVP defaults
    stations.ts         # CMRL station codes and operator constants
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
