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
- demo OTP requests and verification events
- general activity events for future features

### Run locally with backend

1. Open a terminal in this folder.
2. Run:
   `npm start`
3. Open:
   `http://localhost:3000`
4. Admin dashboard:
   `http://localhost:3000/admin.html`

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
