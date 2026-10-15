# Run Knowhere to Grow on another laptop

This package is the student-only Flutter app. It connects to the existing live backend at:

https://lmsfinalproject-seven.vercel.app/api

The API, MongoDB database, and Brevo email service run remotely. You do not need the MERN server folder, Node.js, a local MongoDB installation, or any .env/password/SMTP files. This is the shared live system, not a new copy of the database.

## Before sending the ZIP (project owner)

1. Push the latest backend changes to GitHub, including the Flutter preview CORS fix in server/src/app.js. Wait for the new production Vercel deployment to show Ready. The ZIP does not deploy the backend.
2. Confirm all six SMTP_* variables are saved in Vercel Production and included in a deployment created after saving them. Keep these values private; the recipient does not need them.
3. Open https://lmsfinalproject-seven.vercel.app/api/health. Expect status ok and database connected.
4. Run the extracted app using the steps below. Verify sign-in, Inbox, Deadline extension, and actual email OTP delivery. SMTP authentication alone does not confirm inbox delivery.

## One-time laptop setup (recipient)

- Install Flutter and put its bin folder on PATH. This project was checked using Flutter 3.44.4 with Dart 3.12; its pubspec requires Dart 3.12 or later within major version 3. Use the same Flutter version for the closest match to the tested environment.
- Install Chrome or Microsoft Edge. Git for Windows is also part of Flutter's Windows setup prerequisites.
- Internet access is required for package downloads and live API requests. First launch may download Flutter web tools. Do this before the school demonstration.
- A browser preview does not require Android Studio, an Android SDK, an emulator, or a USB phone. A warning about a missing Android toolchain in flutter doctor does not prevent browser use.
- [Flutter installation guide](https://docs.flutter.dev/install/quick) and [browser setup](https://docs.flutter.dev/platform-integration/web/setup).

## Extract and run

1. Extract the ZIP completely to a writable folder, for example Documents/Knowhere-to-Grow. Do not open/run files inside the ZIP viewer.
2. Open the extracted **mobile** folder in VS Code. It contains pubspec.yaml, lib, android, ios, and web.
3. Open a terminal in that mobile folder. Run:

```powershell
flutter --version
flutter doctor
flutter pub get
flutter devices
flutter run -d chrome --web-hostname=localhost --web-port=5174
```

For Edge, replace the last command with:

```powershell
flutter run -d edge --web-hostname=localhost --web-port=5174
```

Keep the Flutter terminal open while using the preview. The browser opens at http://localhost:5174; the app sends its requests to the deployed HTTPS API. Do not run npm start or a local backend. No API_BASE_URL override is needed for this project.

## Quick school check

1. Sign in with a student account, or register using an inbox you own and the email OTP. Instructors/admins use the React website; Flutter is student-only.
2. After registration, expect login with the registered email prefilled and the password blank. Enter the correct password to open the dashboard.
3. Open an enrolled course, a material, assignments, and grades/feedback.
4. Open Your inbox; expect notifications or an empty-inbox message, not API endpoint not found. Try Mark as read on an unread notification.
5. Open an assignment's Request Deadline Extension; expect its form/history. Do not submit a request unless you intend to ask the instructor.
6. Sign out. If needed, test Forgot password with a disposable test account you own.

## If something fails

| Message or symptom | Action |
| --- | --- |
| flutter is not recognized | Install Flutter, add its bin folder to PATH, then reopen VS Code/terminal. |
| SDK version mismatch | Use Flutter 3.44.4 or a compatible stable release containing Dart 3.12+. Keep pubspec.lock. |
| pubspec.yaml not found | Change into the extracted mobile folder, not its parent. |
| No supported devices | Install/open Chrome or Edge, check flutter devices, and use the explicit -d chrome or -d edge command above. |
| Port 5174 is occupied | Close the previous Flutter preview from its terminal with Ctrl+C, then retry. Keep port 5174 for the deployed preview policy. |
| Login fails due to a suspended/non-student account | Use an active student account; ask the school administrator to check the account if needed. |
| Inbox/extension endpoint not found | Confirm the owner deployed the latest backend, remove any old local API_BASE_URL override, stop Flutter with Ctrl+C, then rerun the command above. |
| Browser CORS/network error | Keep localhost:5174 and confirm the backend preview CORS fix was deployed. Check the school network can reach the HTTPS API. |
| Email delivery is not configured | The owner must correct the Vercel SMTP variables and redeploy. No SMTP credentials belong on this laptop. |
| OTP does not arrive | Check Spam, use the latest code, and wait for the resend timer. The owner should inspect Brevo sending status/logs. |

This ZIP contains source, not a Flutter SDK or an installed Android/iOS app. Browser analysis/tests/build passed locally; the recipient's installation and live deployment still need the quick check above.
