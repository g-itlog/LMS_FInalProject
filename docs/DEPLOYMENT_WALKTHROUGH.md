# Deploy Knowhere to Grow on Vercel

The web application now includes a web-only administrator workspace. After deploying the updated source, follow [ADMIN_GUIDE.md](ADMIN_GUIDE.md) to create the first administrator against the same Atlas database. Existing Vercel environment variables remain sufficient; Flutter remains student-only. Administrators issue single-use instructor invitations: successful signup consumes a code permanently using an Atlas transaction. Unused codes can be edited or deactivated, and consumed codes appear only in read-only used history.

This project deploys React and the Express API together in **one Vercel project**, with MongoDB Atlas storing records and GridFS files. Your local server and PC do not need to run after deployment. Uploads are limited to **3 MB** in the API, web client, and Flutter app to leave room below Vercel Functions' 4.5 MB request limit. No Blob storage setup is required.

## 1. Check and push the code

From the repository root:

```powershell
npm run deploy:check
npm run build
git status
git add .
git diff --cached --stat
git commit -m "Configure Knowhere to Grow for Vercel"
git push origin main
```

The repository is `g-itlog/LMS_FInalProject`. Review staged files: `.env`, private credentials, caches, and submission ZIPs must remain ignored. If files were staged before the Vercel changes, run `git add .` again to include the new API entry point and root configuration.

## 2. Prepare Atlas

Keep `MONGO_DB_NAME=classroom_lms` to use the existing accounts, courses, and files. Use your private connection string in the hosting dashboard and your local `.env`. A database user needs read/write access to this database. Atlas supports the transactions required for single-use instructor signup.

Atlas must allow connections from Vercel, not just your PC. Standard Vercel functions can use changing outbound IP addresses. For a student demonstration, Atlas's Network Access screen can allow `0.0.0.0/0`; this permits database connection attempts from all IP addresses, so authentication, a strong private database password, and database-scoped permissions are essential. For restricted production networking, use a static-egress/private-network configuration supported by your hosting/database plans. Never put the database URI in public frontend variables.

## 3. Import the GitHub repository into Vercel

Select **Add New > Project**, connect GitHub, and import `LMS_FInalProject`.

| Setting | Value |
| --- | --- |
| Project Name | An available name such as `knowhere-to-grow` |
| Root Directory | **Repository root: `.`** (leave the directory field at the repository root) |
| Framework Preset | Vite |
| Node.js | 22.x |
| Install Command | `npm ci --include=dev && npm --prefix client ci --include=dev && npm --prefix server ci --omit=dev` |
| Build Command | `npm run build` |
| Output Directory | `client/dist` |

The checked-in root `vercel.json` supplies these commands, routes `/api/*` to `api/index.js`, and provides the React Router fallback. **Do not select `client` or `server` as Root Directory.** The Vercel adapter reuses the database connection pool across warm requests and retries failed initialization. The ordinary `server/index.js` listener remains available for local development.

The explicit `--include=dev` on the client installation is required because Vite is a build dependency, even when `NODE_ENV=production`. The API installation omits its test-only dependencies.

Before clicking Deploy, add these private environment variables for Production and, if desired, Preview:

| Variable | Value |
| --- | --- |
| `MONGO_URL` | Your private Atlas connection string |
| `MONGO_DB_NAME` | `classroom_lms` |
| `JWT_SECRET` | A strong random secret of at least 32 characters |
| `INSTRUCTOR_INVITE_CODE` | Your existing code; imported once into the admin-managed list as a single-use invitation |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGINS` | Exact HTTPS production origin, such as `https://YOUR-ACTUAL-SITE.vercel.app` |

Generate a secret locally if needed:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy the output privately into Vercel. Do not commit it. No `PORT`, `DEMO_PASSWORD`, or `VITE_MONGO_URL` is required for this deployment. Do not seed automatically during builds. Existing Atlas records are reused.

The runtime also recognizes Vercel's platform-provided `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` when supplied. Once Vercel assigns the actual production domain, verify `CLIENT_ORIGINS` matches it exactly, with no path or trailing slash. List additional explicitly allowed domains separated by commas. If variables are changed after deployment, redeploy so the new values apply.

Click **Deploy**. Both the React website and Express API are served on the same domain. Axios keeps its existing `/api` base URL, preserving HTTP-only, Secure, SameSite=Lax session cookies.

## 4. Test the deployed app with local terminals stopped

1. Open `https://YOUR-SITE.vercel.app/api/health`. Expect JSON with `status: ok`, `database: connected`, and `maxAttachmentBytes: 3145728`.
2. Sign in, reload, and directly open a course URL to test the cookie and React Router fallback.
3. As an instructor, create a test course, material, assignment, and announcement. Edit and delete test records as needed.
4. As an enrolled student, download the material, submit a text/file response, and view the grade and feedback saved by the instructor.
5. Test a permitted file up to 3 MB and confirm that larger attachments show the 3 MB validation message. Existing resource links remain usable for larger external learning materials.
6. Sign out, then verify protected content is unavailable until the next login.
7. Test from a phone over mobile data while your PC's local terminals are stopped.

Local API/browser/Flutter tests validate the application and function handler. They do not prove that your Vercel account, environment variables, Atlas network policy, or deployed routing are correct. Complete these live checks after you deploy.

## 5. Connect the Flutter student app

From `mobile`, rebuild with the Vercel production API URL:

```powershell
flutter run -d YOUR_DEVICE_ID --dart-define=API_BASE_URL=https://YOUR-SITE.vercel.app/api
```

For an Android APK:

```powershell
flutter build apk --debug --dart-define=API_BASE_URL=https://YOUR-SITE.vercel.app/api
```

Use HTTPS and include `/api`. The native app uses student bearer sessions against the same API and 3 MB upload limit. For browser preview, use `-d chrome` and explicitly add `http://localhost:5174` to `CLIENT_ORIGINS` for that test, then redeploy the API. Vercel does not build an Android APK or iOS IPA; Android SDK/device setup and iOS/macOS/signing requirements still apply.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `/api/health` returns HTML or 404 | Root Directory must be `.`, the root `vercel.json` and `api/index.js` must be pushed, and output must be `client/dist` |
| API returns 503 | Check Vercel function logs, Atlas credentials/network access, and required environment variables |
| Browser write returns 403 | Set `CLIENT_ORIGINS` to the exact website origin and redeploy |
| An upload exceeds the limit | Maximum attachment size is 3 MB; resource URLs can point to larger external materials |
| Website still shows the previous version | Confirm the latest commit was pushed and selected in the deployment |
| Flutter still tries localhost | Stop the app and rebuild with the HTTPS production API_BASE_URL |

## References

- [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel project configuration](https://vercel.com/docs/project-configuration)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [MongoDB Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
