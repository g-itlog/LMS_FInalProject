# Deploy Knowhere to Grow from GitHub

Use Vercel for `client`, Render for `server`, and MongoDB Atlas for the database and GridFS attachments. After deployment, hosting services run the application independently of your PC. This guide prepares deployment; it does not claim a live deployment has been verified.

## 1. Push the current project

From the project root, review changes and push them:

```powershell
git status
git add .
git diff --cached --stat
git commit -m "Prepare Knowhere to Grow for deployment"
git push origin main
```

The repository is `https://github.com/g-itlog/LMS_FInalProject`. Local `.env` and credentials must remain ignored. The recent design, rename, and deployment helpers need to be included in this push.

## 2. Create the backend service on Render

Sign in to Render using GitHub. Select **New > Web Service**, connect the repository, and use:

| Setting | Value |
| --- | --- |
| Name | `knowhere-to-grow-api` or an available service name |
| Branch | `main` |
| Language | Node |
| Root Directory | `server` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Use a supported Node.js 22.20+ runtime. Let Render supply `PORT`; do not copy the local port setting. There is no client build step on this service. Do not use the development launcher or run the seed command during deployment.

Add these in the service's private Environment settings:

| Variable | Value |
| --- | --- |
| `MONGO_URL` | Your Atlas URI using a rotated database password |
| `MONGO_DB_NAME` | `classroom_lms` (the existing database) |
| `JWT_SECRET` | A new random secret of at least 32 characters |
| `INSTRUCTOR_INVITE_CODE` | A private instructor registration code |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` for the service's immediate hosting proxy; verify the actual chain during live checks |
| `CLIENT_ORIGINS` | The exact HTTPS Vercel production origin; update after Vercel assigns it |

If you do not have the Vercel URL yet, create the backend with a placeholder origin such as `https://your-site.vercel.app`, then replace it with the actual origin in step 5. This does not block the API health check, but browser writes must not be tested until the real origin is allowed. Use an origin without a trailing slash or `/api`; multiple explicitly allowed origins are comma-separated. Never put these secrets in `VITE_` variables.

Because the database password was shared in the project conversation, rotate it in Atlas before public deployment, then update the private hosting variable and your local `.env`. Generate `JWT_SECRET` locally, for example:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy that output privately into Render. It is not a password for an existing user account. `DEMO_PASSWORD` is not needed at runtime; existing users and courses remain in Atlas.

## 3. Allow Render to reach Atlas

In the Render service, open **Connect > Outbound** and copy its outbound IP ranges. Add those ranges to the Atlas project's **Network Access / IP Access List**. Allowing only your PC's IP will not allow the hosted server to connect. Redeploy the backend if the first deployment failed while network access was being configured.

Wait for a successful deployment, then open:

```text
https://YOUR-ACTUAL-BACKEND.onrender.com/api/health
```

It must return JSON containing `"status":"ok"` and `"database":"connected"`. Keep the exact backend URL that Render assigned; example names in this guide are not deployed services.

## 4. Configure the frontend route and push it

From the project root, substitute the real backend URL:

```powershell
npm run deploy:configure -- https://YOUR-ACTUAL-BACKEND.onrender.com
git add client/vercel.json
git commit -m "Connect Vercel frontend to hosted API"
git push origin main
```

The command generates `client/vercel.json` from the checked-in example. It forwards `/api/*` to the hosted API, preserves the `/api` prefix, prevents API caching, and adds the React Router fallback. It uses a public URL only. There is no live config containing a guessed backend URL.

The browser continues to call `/api` on the Vercel website. This is needed for the current HTTP-only, Secure, SameSite=Lax login cookie. Do not change Axios to call a separate Render origin directly; that requires a different cross-site authentication design.

## 5. Import into Vercel

In Vercel, select **Add New > Project**, import the GitHub repository, and use:

| Setting | Value |
| --- | --- |
| Project Name | An available name, such as `knowhere-to-grow` |
| Production Branch | `main` |
| Framework Preset | Vite |
| Root Directory | `client` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Deploy. Backend secrets are configured in Render, not in this frontend project. Use Vercel's stable production URL, rather than a temporary deployment preview URL. Copy that exact origin into Render's `CLIENT_ORIGINS`, save, and wait for the backend to redeploy. Add a custom domain separately if you later use one. Preview deployment domains are not automatically trusted by the backend.

## 6. Verify without your local server

1. Open `https://YOUR-VERCEL-SITE.vercel.app/api/health`. Check for database-connected JSON, not the React HTML page.
2. Sign in, reload, open a course directly by URL, and verify that the session and React routes work.
3. Create a test assignment/material on the instructor web app, submit test student work, grade it, and confirm student feedback.
4. Upload and download a small test file, then an allowed file larger than 4.5 MB to verify the deployed upload path. Do not assume the app's 20 MB limit has been proven on the hosting path before this check.
5. Stop the local terminals and test from your phone using mobile data. Login, courses, and downloads should still work.

The server's ordinary 20 MB upload handling remains on Render. A backend running inside Vercel Functions has a 4.5 MB request/response payload limit and requires a different large-file design. External rewrites are used here instead of placing Express inside a Vercel Function; live upload testing is still required.

Render Free services sleep after 15 idle minutes and can take about one minute to wake. The client currently times out ordinary API requests after 30 seconds. For a free demonstration, open the Render health endpoint first, wait until it responds successfully, and retry the website if the first request timed out. A paid backend instance avoids this particular idle-sleep limitation. Usage quotas and service availability still apply.

## 7. Point Flutter at the hosted backend

From `mobile`, rebuild/run using the same hosted API:

```powershell
flutter run -d YOUR_DEVICE_ID --dart-define=API_BASE_URL=https://YOUR-ACTUAL-BACKEND.onrender.com/api
```

For browser preview, use `-d chrome` and explicitly include `http://localhost:5174` in Render's allowed origins for that test. Native student bearer authentication uses the Render API directly. Use HTTPS and include `/api`. Vercel does not build a Flutter APK or IPA. Stop any previously installed/debug app that still points at `10.0.2.2` or localhost and rebuild it with this setting.

## References

- [Render Express deployment](https://render.com/docs/deploy-node-express-app)
- [Render monorepo root directories](https://render.com/docs/monorepo-support)
- [Render outbound addresses](https://render.com/docs/outbound-ip-addresses)
- [MongoDB Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)
- [Vite SPA routing on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Render Free service limitations](https://render.com/docs/free)
