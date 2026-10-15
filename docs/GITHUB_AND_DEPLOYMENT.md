# GitHub and Vercel deployment

Repository: [g-itlog/LMS_FInalProject](https://github.com/g-itlog/LMS_FInalProject).

Use the [single-project Vercel deployment walkthrough](DEPLOYMENT_WALKTHROUGH.md). The React website and Express API now share one Vercel deployment; MongoDB Atlas stores academic records and GridFS attachments.

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

On Vercel, select Root Directory **`.`**, Framework **Vite**, Build Command **`npm run build`**, and Output Directory **`client/dist`**. The root `vercel.json` supplies installation commands and routing. The root `api/index.js` invokes the shared Express app with a cached MongoDB connection pool. Set private database/auth environment variables in Vercel and run the walkthrough's live smoke checks after deployment.

Attachments are limited to 3 MB across the backend, React, and Flutter, below the Vercel Function payload limit with space for form fields. API routes use the website's origin so the existing secure cookie authentication works without cross-site cookies. The ordinary local `npm run dev` workflow remains available.

The Flutter app uses the production website's `/api` endpoint through `--dart-define=API_BASE_URL=https://YOUR-SITE.vercel.app/api`. Its APK/IPA is built separately with Flutter.

Do not commit `.env`, private local credentials, signing keys, caches, or generated source ZIPs. Database records are in Atlas, not GitHub. Builds must not run the seed command. Keep the existing `classroom_lms` database name when reusing the project's records.
