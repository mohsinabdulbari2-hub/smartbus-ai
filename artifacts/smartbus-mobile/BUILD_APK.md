# Build a Downloadable APK

This mobile app is now configured to be built as a downloadable Android APK using **EAS Build** (Expo's cloud build service).

App identity:
- **App name:** Bus Overcrowding Prediction System
- **Android package:** `com.busoverpredict.app`
- **Version:** 1.0.0

---

## Option A — Cloud build (recommended, no Android SDK needed)

This builds the APK on Expo's servers and gives you a download link.

### 1. Create a free Expo account
Sign up at https://expo.dev/signup if you don't already have one.

### 2. Install EAS CLI (one-time, on your local machine or in the shell)
```bash
npm install -g eas-cli
```

### 3. Log in
From the project root:
```bash
cd artifacts/smartbus-mobile
pnpm run eas:login
```

### 4. Link the project to your Expo account (one-time)
```bash
pnpm run eas:init
```
This adds an `extra.eas.projectId` value to `app.json`.

### 5. Build the APK
```bash
pnpm run build:apk
```
This runs the `preview` profile (configured in `eas.json`) which produces a standalone **APK** you can install on any Android device.

When it finishes, EAS prints a URL — open it to download the `.apk` file. Transfer it to an Android phone and install it (you may need to enable "Install from unknown sources").

---

## Option B — Local build (requires Android SDK + Java)

If you have Android Studio / the Android SDK installed locally:
```bash
pnpm run build:apk:local
```

---

## Build profiles (`eas.json`)

| Profile           | Output    | Purpose                                      |
| ----------------- | --------- | -------------------------------------------- |
| `development`     | APK       | Dev client build for debugging on device     |
| `preview`         | **APK**   | **Internal distribution / sideloading**      |
| `production`      | AAB       | Google Play Store upload                     |
| `production-apk`  | APK       | Production-signed APK (sideload distribution)|

---

## Updating the version

Bump `expo.version` and `expo.android.versionCode` in `app.json` before each new release:
```json
"version": "1.0.1",
"android": {
  "versionCode": 2,
  ...
}
```

---

## Troubleshooting

- **"Project is not configured"** → Run `pnpm run eas:init` first.
- **Build fails with "No matching profile"** → Make sure `eas.json` is in `artifacts/smartbus-mobile/`.
- **App installs but won't open** → Check that `android.package` in `app.json` matches what's registered in EAS.
