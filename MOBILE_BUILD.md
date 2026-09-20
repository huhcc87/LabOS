# LabOS Mobile Build Guide

Step-by-step instructions to build, test, and submit the LabOS iOS and Android apps.
Both platforms use Capacitor 8 wrapping the React/Vite frontend.

---

## Prerequisites

| Tool | Required version | Install |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Xcode | 15+ | Mac App Store |
| Android Studio | Hedgehog+ | https://developer.android.com/studio |
| Java (JDK) | 17+ | `brew install openjdk@17` |
| CocoaPods | Latest | `sudo gem install cocoapods` |
| Capacitor CLI | bundled in devDeps | `npx cap --version` |

---

## 1. Build the web bundle

```bash
cd frontend
npm install
npm run build        # outputs to frontend/dist/
```

---

## 2. Sync Capacitor

```bash
# From frontend/
npx cap sync         # copies dist/ into ios/App/public and android/app/src/main/assets/public
```

This also installs any new Capacitor plugins into the native projects.

---

## 3. Configure the backend URL

### Development (hot-reload)

```bash
# Replace with your machine's LAN IP (not localhost — phones can't reach localhost)
CAPACITOR_DEV_URL=http://192.168.1.100:5173 npx cap sync
```

### Production build

Leave `CAPACITOR_DEV_URL` unset. The app will serve from the bundled `dist/`. The backend
API base URL is set via the `VITE_API_URL` env var:

```bash
VITE_API_URL=https://api.yourdomain.com npm run build
npx cap sync
```

---

## 4. iOS

### Open in Xcode

```bash
npx cap open ios
```

### Configure signing (one-time)

1. In Xcode → **TARGETS → App → Signing & Capabilities**
2. Select your **Team** (requires Apple Developer account — $99/year)
3. Set **Bundle Identifier** to `com.labos.app`

### Run on simulator

```bash
npx cap run ios --target "iPhone 15 Pro"
# or open Xcode → select simulator → ▶ Run
```

### Run on physical device

Connect iPhone → trust device in Xcode → select it as the target → ▶ Run

### Build for TestFlight / App Store

1. In Xcode → **Product → Archive**
2. In the Organizer → **Distribute App → App Store Connect**
3. Follow the wizard — upload to App Store Connect
4. In App Store Connect → TestFlight → select the build → invite testers

### App Store submission checklist

- [ ] Privacy policy URL in App Store Connect
- [ ] App icon set (1024×1024 for store + all sizes in Assets.xcassets)
- [ ] Screenshots for iPhone 6.7" and 6.5" + iPad 12.9"
- [ ] Age rating set
- [ ] Review notes: "This is a research lab management system. Demo: admin@lab.local / Admin123!"

---

## 5. Android

### Open in Android Studio

```bash
npx cap open android
```

### Run on emulator

```bash
npx cap run android --target "Pixel_7_API_34"
# or use Android Studio → select emulator → ▶ Run
```

### Run on physical device

Enable USB Debugging on device → connect via USB → select device in Android Studio → ▶ Run

### Generate a release keystore (one-time)

```bash
cd frontend/android
keytool -genkey -v -keystore release-keystore.jks \
  -alias labos \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=LabOS, OU=Dev, O=LabOS, L=City, S=State, C=US"
```

Set in `capacitor.config.ts` (already configured):
```ts
android: {
  buildOptions: {
    keystorePath: 'release-keystore.jks',
    keystoreAlias: 'labos',
  },
},
```

Add to `android/app/build.gradle`:
```groovy
android {
  signingConfigs {
    release {
      storeFile file('../../release-keystore.jks')
      storePassword System.getenv('KEYSTORE_PASSWORD')
      keyAlias 'labos'
      keyPassword System.getenv('KEY_PASSWORD')
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
    }
  }
}
```

### Build release APK / AAB

```bash
cd frontend/android
./gradlew bundleRelease     # produces app-release.aab (preferred for Play Store)
./gradlew assembleRelease   # produces app-release.apk (for direct install)
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### Play Store submission

1. Go to https://play.google.com/console
2. Create application → set package name `com.labos.app`
3. Upload `app-release.aab` to **Internal testing** first
4. Fill in store listing: title, description, screenshots (phone + tablet)
5. Content rating questionnaire
6. Privacy policy URL
7. Promote from Internal → Closed → Open testing → Production

### Play Store checklist

- [ ] Google Play Developer account ($25 one-time fee)
- [ ] Privacy policy URL
- [ ] Feature graphic 1024×500
- [ ] Phone screenshots (min 2): 1080×1920 or similar
- [ ] Tablet screenshots (optional but recommended)
- [ ] Short description (80 chars max)
- [ ] Full description (4000 chars max)
- [ ] Content rating: Everyone

---

## 6. Push Notifications (optional)

Push notifications are pre-configured in `capacitor.config.ts`. To enable:

### iOS (APNs)
1. Xcode → Signing & Capabilities → + Push Notifications
2. Generate APNs key in Apple Developer Portal
3. Upload key to your backend notification service

### Android (FCM)
1. Create project in Firebase Console
2. Download `google-services.json` → place in `android/app/`
3. Add to `android/app/build.gradle`: `apply plugin: 'com.google.gms.google-services'`
4. Set `FCM_SERVER_KEY` env var on the backend

---

## 7. Quick-build script

Use `build-mobile.sh` in the project root for a one-command build:

```bash
# iOS simulator
bash build-mobile.sh ios

# Android emulator
bash build-mobile.sh android

# Both
bash build-mobile.sh all

# Production bundle (sets VITE_API_URL)
VITE_API_URL=https://api.labos.app bash build-mobile.sh all
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `cap sync` fails — CocoaPods error | `cd frontend/ios/App && pod install` |
| Android build fails — SDK missing | Android Studio → SDK Manager → install API 34 |
| White screen on device | Check `VITE_API_URL` is reachable from device; CORS allows the app origin |
| API calls fail on iOS | Backend must use HTTPS; HTTP is blocked by ATS. Use ngrok or deploy |
| "No provisioning profile" Xcode | Set team and bundle ID in Signing & Capabilities |
