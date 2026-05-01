# Plan

## [ ] Dual APK: Standard + Razorpay A99

**Problem:** `libQuickCrypto.so` uses `EVP_MAC_CTX_free` (OpenSSL 3.0+). A99 has OpenSSL 1.x → crash.

**Fix:** Android product flavors
- `standard` — current setup, unchanged
- `razorpay` — replace `react-native-quick-crypto` with pure-JS crypto fallback

**Files to change:**
- `android/app/build.gradle` — add flavor config
- crypto import in app code — conditional per flavor

**Output:** `app-standard-debug.apk` + `app-razorpay-debug.apk`

## [ ] Build Release APK (no Metro dependency)

```bash
npx expo run:android --variant release
```

## [ ] Fare API 500 — PERSON_NOT_FOUND

**Root cause:** External API (`api.sandbox.moving.tech`) returns HTTP 500 when mobile number not registered. Server-side bug — their error handling broken.

**Our fix needed:** Catch 500 + parse `errorCode:"PERSON_NOT_FOUND"` → show user-friendly message instead of generic "API failure".
