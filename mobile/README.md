# Knowhere to Grow · Flutter student application

This is the **student-only** Flutter Android/iOS app, with a browser preview, for the same Express backend used by the React web app. Instructors use the React web dashboard. Student-app authentication endpoints reject instructor accounts before issuing a token.

Implemented: student registration/login, dashboard statistics, enrolled courses and catalog enrollment, material links and authenticated downloads, assignment instructions/deadlines, file and text submissions, grades and instructor feedback, announcements, profile/password updates, and server-revoked logout.

Login and registration validate edited fields as you type. Registration includes a live password checklist and enforces the API's 72-byte UTF-8 limit. Invalid submissions focus the first invalid field; switching between forms clears credentials and validation. Mobile registration remains student-only. Password and account verification happens on submission against the shared API.

For the Vercel deployment, rebuild with `--dart-define=API_BASE_URL=https://YOUR-SITE.vercel.app/api`. The website and API share that deployment; Atlas stores the data and files. Attachments are limited to 3 MB in both clients and the backend. Follow [the deployment walkthrough](../docs/DEPLOYMENT_WALKTHROUGH.md) for the exact hosting settings.

## Run on this PC now (Chrome or Edge)

The error **“No supported devices connected”** means Flutter found no Android/iOS device for the original mobile-only project. This PC has Flutter and browsers, but the Android SDK is not installed. A browser target is now included so you can run and test the student app immediately.

In one terminal, start the backend from `server` using `npm run server` (or leave the existing backend running). In another terminal, from `mobile`:

```powershell
flutter pub get
flutter run -d chrome
# Or:
flutter run -d edge
```

The installed Flutter SDK reads `web_dev_config.yaml` and uses **http://localhost:5174**. For older Flutter versions that do not read this file, add `--web-port=5174`. The browser app defaults to `http://localhost:8000/api`. This origin is included in the server's local configuration; restart a previously running API after updating `.env`.

Browser preview supports student registration/login, course enrollment, file-picker submissions, resource downloads, grades, announcements, and profile/logout. Browser downloads use the browser download folder; Android/iOS still use private app documents. Browser token storage uses the secure-storage web implementation and requires localhost or HTTPS. This preview does not verify native Android plugins or produce an APK.

## Run on Android

Install Flutter stable (Dart 3.12+), Android SDK/platform tools, and an emulator or connected device. Follow [the official setup](https://docs.flutter.dev/platform-integration/android/setup), including reviewing and accepting SDK licenses yourself. An iOS build requires macOS/Xcode.

Start the backend from `server` with `npm start`, then:

```powershell
flutter pub get
flutter devices
flutter run -d YOUR_ANDROID_DEVICE_ID --dart-define=API_BASE_URL=http://10.0.2.2:8000/api
```

The URL **must include `/api`** and omit a trailing slash. For a physical phone replace `10.0.2.2` with your PC’s LAN IP (same Wi-Fi; allow inbound port 8000). For iOS simulator use `http://127.0.0.1:8000/api` with a local ATS development exception, or use HTTPS. Production must use an HTTPS API; Android cleartext traffic is enabled only in the debug manifest.

If Android is absent from `flutter devices`, open Android Studio → SDK Manager and install the Android SDK, platform tools, and command-line tools. Run `flutter doctor --android-licenses` and review/accept the licenses. Then either start an emulator from Device Manager or connect an Android phone with USB debugging enabled and authorize the PC. Check `flutter doctor` and `flutter devices` again before running the app.

```powershell
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:8000/api
# Physical phone demonstration:
flutter build apk --debug --dart-define=API_BASE_URL=http://YOUR_PC_LAN_IP:8000/api
# Production (configure a release signing key first):
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api
```

The generated Android release configuration uses Flutter’s default debug signing key until a proper release signing configuration is supplied. Do not publish that build to an app store. No signing keys or database credentials belong in the repository.

## Storage, downloads, and submissions

- JWT tokens are stored using `flutter_secure_storage` (Android Keystore / iOS Keychain; the package's web storage implementation for browser preview). Never print tokens or use real student data on a shared preview PC.
- Downloads use the same protected `/files/:id` endpoint. They are saved in the app’s private documents folder and opened with an installed viewer using `open_filex`. No shared-storage permission is required. Logging out revokes API access; previously downloaded files remain on the device until app data is cleared or the app is uninstalled.
- Resource links open in an external browser; only HTTP(S) is accepted.
- File selection uses the native file picker. Maximum size is 3 MB; text response and/or file is required. The API enforces enrollment, deadlines, file validation, and graded-work locking.
- Data refreshes on tab navigation and on return from course/assignment screens. Pull down to refresh lists. The app requires a network connection and shows retryable error states; it does not queue submissions offline.
- Password changes rotate the current mobile session and revoke other browser/mobile sessions.

## Verify

```powershell
flutter analyze
flutter test
flutter build web --no-web-resources-cdn
```

The rendering tests write Flutter widget screenshots to `../docs/screenshots/flutter-*.png` at 390 × 844 logical pixels. Additional tests check login, dashboard, and course views at 320 pixels with 1.3× text scaling and verify the next-assignment action. These are actual Flutter-rendered UI images using demo-only API fixtures, not screenshots from an emulator or physical phone. Network behavior tests verify endpoints, student-only role checks, bearer headers, secure storage, and token expiry. The Express integration suite separately verifies complete mobile authentication and shared database behavior.

The web and Flutter interfaces share an ink-blue, warm-paper design with Public Sans and Lora fonts bundled locally under the included SIL Open Font Licenses. After pulling font/theme changes, stop the running Flutter session, run `flutter pub get`, and run the app again so the updated asset bundle loads.
