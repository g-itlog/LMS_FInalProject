# GitHub and deployment

Repository: [g-itlog/LMS_FInalProject](https://github.com/g-itlog/LMS_FInalProject)

For the step-by-step Vercel frontend + Render API setup, use [the deployment walkthrough](DEPLOYMENT_WALKTHROUGH.md). Run `npm run deploy:configure -- https://YOUR-ACTUAL-BACKEND.onrender.com` after Render assigns a live API URL; this generates the frontend routing configuration without guessing a hostname.

The repository contains the React client, Express server, Flutter student app, setup instructions, documentation, and tests. Database records remain in MongoDB Atlas; GitHub stores source files, not the database.

## Work with this repository

From the project root:

```powershell
git status
git add .
git commit -m "Describe your change"
git push origin main
```

Review `git status` and staged changes before each commit. `.env`, private local credentials, dependencies, Flutter build caches, signing keys, backups, and generated submission ZIPs are ignored. The checked-in `server/.env.example` contains placeholders only. Configure a fresh clone using the root README; local credentials are deliberately absent from GitHub.

## Vercel deployment planning

Connecting GitHub does not publish a running application. Import the repository into Vercel only after choosing how to host the Express API. The Flutter Android/iOS application is built using Flutter; Vercel does not build or distribute its native APK/IPA.

The React application is built with Vite. Its client build settings are:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | `client` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |

These settings build the frontend only. The current frontend calls `/api` on its own origin. Vite's local proxy is a development feature and does not exist on Vercel. A production deployment must route `/api` to the deployed Express API and serve `index.html` for React Router pages. Do not deploy just the frontend and assume authentication, courses, uploads, or grades will work without the API route.

### Backend and files

The current server runs as a persistent Node.js process using `npm start` inside `server`. For a deployment that preserves the existing 20 MB upload behavior, run it on a Node.js host that supports the required request size. Configure HTTPS, Atlas network access, and the exact frontend origin in `CLIENT_ORIGINS`. Keep browser API requests on the website's origin using a deployment proxy; the HTTP-only session cookie currently uses `SameSite=Lax`. A direct cross-site API URL needs a separate authentication/cookie design and is not a drop-in replacement.

Vercel also supports Express applications as Functions, but a Vercel Function's request body limit is **4.5 MB**. The app's current multipart uploads can be **20 MB**. An all-Vercel deployment therefore needs direct file-storage uploads or a deliberate smaller upload limit with matching interface validation. Changing Multer's limit alone cannot raise Vercel's platform limit. MongoDB GridFS file persistence does not bypass the incoming request limit.

Before an all-Vercel backend deployment, also adapt startup to the supported function/Express export, reuse database connections across warm requests, and configure routing and secrets. These are deployment tasks; pushing this repository does not claim they have been completed.

### Environment variables

Add these privately to the backend hosting platform, never to source code or public `VITE_` variables:

- `MONGO_URL`: a MongoDB Atlas connection string with a rotated password.
- `MONGO_DB_NAME`: `classroom_lms`.
- `JWT_SECRET`: a strong random secret with at least 32 characters.
- `INSTRUCTOR_INVITE_CODE`: a private code for instructor registration.
- `CLIENT_ORIGINS`: the exact HTTPS frontend URL and any explicitly allowed test origins.
- `NODE_ENV`: `production`.
- `TRUST_PROXY`: configure only for the actual hosting proxy chain.

`DEMO_PASSWORD` is needed only when intentionally creating demo accounts through the seed command; it is not needed to serve the app. Do not run database seeding automatically for every deployment. Existing Atlas courses and user records remain available when the deployed backend points to the same database.

After obtaining a deployed API URL, build Flutter with `--dart-define=API_BASE_URL=https://YOUR_API_HOST/api`. Never put the MongoDB URI or JWT signing secret inside Flutter.

## References

- [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
