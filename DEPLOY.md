# SymptoScan Deployment

This project is ready to deploy as a website with a lightweight Node backend for `symptoscan.com`.

## Recommended: Render

This project now fits Render better than plain static hosting because it includes:

- frontend pages
- backend APIs
- admin dashboard
- local JSON persistence

### Render deployment steps

1. Push this full project to a GitHub repository.
2. Go to [render.com](https://render.com/).
3. Sign in and click `New +`.
4. Choose `Blueprint` or `Web Service`.
5. Connect your GitHub repository.
6. If Render detects [render.yaml](C:\Users\amanr\OneDrive\Desktop\SymptoScan\render.yaml), approve the setup.
7. If you create it manually, use:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
8. Deploy.
9. After deploy, open the Render URL and test:
   - `/`
   - `/admin.html`
   - `/api/health`

### OTP email setup on Render

The signup OTP backend now supports two real email providers:

- `Resend`
- `Gmail SMTP`

Set these environment variables in Render `Settings -> Environment`:

- `OTP_EMAIL_PROVIDER`
- `OTP_FROM_NAME`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GMAIL_EMAIL`
- `GMAIL_APP_PASSWORD`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `INFERMEDICA_APP_ID`
- `INFERMEDICA_APP_KEY`
- `GOOGLE_MAPS_API_KEY`

Use one provider at a time.

### External medical APIs

The dashboard can now use these server-side integrations without exposing keys in the frontend:

- `GEMINI_API_KEY` to clean the user symptom text
- `INFERMEDICA_APP_ID`
- `INFERMEDICA_APP_KEY`
- `GOOGLE_MAPS_API_KEY` to find nearby doctors from the saved profile location

The backend endpoint used by the dashboard is:

- `POST /api/symptom-check`

Infermedica diagnosis URL used by the backend:

- `https://api.infermedica.com/v3/diagnosis`

#### Option A: Resend

Set:

- `OTP_EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=your_resend_api_key`
- `RESEND_FROM_EMAIL=onboarding@yourdomain.com`
- `OTP_FROM_NAME=SymptoScan`

Notes:

- the sender email must be verified in Resend
- this is the easiest production option

#### Option B: Gmail SMTP

Set:

- `OTP_EMAIL_PROVIDER=gmail`
- `GMAIL_EMAIL=yourgmail@gmail.com`
- `GMAIL_APP_PASSWORD=your_16_character_app_password`
- `OTP_FROM_NAME=SymptoScan`

Notes:

- use a Gmail App Password, not your normal Gmail password
- 2-Step Verification must be enabled on the Gmail account
- Gmail is fine for small testing use, but Resend is usually better for production delivery

### Connect `symptoscan.com`

1. In Render, open your service.
2. Go to `Settings` -> `Custom Domains`.
3. Add:
   - `symptoscan.com`
   - `www.symptoscan.com`
4. Add the DNS records Render gives you at your domain registrar.
5. Wait for DNS propagation.

### Important Render note

This backend currently stores data in:

- `backend/data/db.json`

On free/simple hosted environments, local file storage may not be durable long-term across redeploys or instance changes.
That means Render is fine for testing and demos, but for production-grade user data you should later move to:

- PostgreSQL
- MySQL
- MongoDB
- Supabase
- Firebase

I can help you do that next.

## Backend Mode

This project now also includes a lightweight Node backend for local development and future feature growth.

### What the backend stores

- identified visitors/users
- symptom searches and generated results
- OTP requests and delivery events
- general activity events for future features

### Run locally with backend

1. Open a terminal in this folder.
2. Run:
   `npm start`
3. Open:
   `http://localhost:3000`
4. Admin dashboard:
   `http://localhost:3000/admin.html`

### Smoke test the full flow

With the backend running locally, you can verify signup, profile save, search logging, and admin visibility from the terminal:

`npm run smoke:test`

This test works best when OTP delivery is still in demo mode because it reads the returned OTP from the API response.

### Backend files

- `package.json`
- `backend/server.js`
- `admin.html`
- `admin.js`

### Important note

The backend currently uses JSON file storage in `backend/data/db.json`, created automatically on first run.
This is great for development and demos. Later we can upgrade it to MySQL, PostgreSQL, MongoDB, Supabase, Firebase, or any other database you want.

## Option 1: Vercel

1. Create a GitHub repository and upload these files.
2. Go to [vercel.com](https://vercel.com/).
3. Import the repository.
4. Keep the project as a static site with no build command.
5. Deploy.
6. In Vercel project settings, add the custom domain `symptoscan.com`.
7. Also add `www.symptoscan.com` and set one version to redirect to the other.
8. Update your domain DNS records to the values Vercel gives you.

## Option 2: Netlify

1. Create a GitHub repository and upload these files.
2. Go to [netlify.com](https://netlify.com/).
3. Add a new site from Git.
4. Choose this repository.
5. Set the publish directory to `.` and leave the build command empty.
6. Deploy.
7. In Domain management, connect `symptoscan.com`.
8. Add `www.symptoscan.com` and configure your preferred primary domain.

## Google Search

1. Open Google Search Console.
2. Add the property `https://symptoscan.com/` or the full domain property.
3. Verify domain ownership using the DNS record Google gives you.
4. Submit `https://symptoscan.com/sitemap.xml`.
5. Request indexing for the homepage after launch.

## Files Used In Production

- `index.html`: main homepage
- `Frontscan.css`: site styles
- `Sympto.js`: browser behavior
- `admin.html`: admin dashboard
- `admin.js`: admin dashboard logic
- `package.json`: backend run script
- `backend/server.js`: backend API and static server
- `render.yaml`: Render deployment config
- `robots.txt`: crawler instructions
- `sitemap.xml`: search sitemap
- `vercel.json`: Vercel static hosting config
- `netlify.toml`: Netlify hosting config
