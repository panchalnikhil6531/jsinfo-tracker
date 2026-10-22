# JavaScript.info Progress Tracker

Track your progress through javascript.info and see everyone else's on a shared leaderboard.

- `public/` — frontend (plain HTML/CSS/JS)
- `server/` — Express + MongoDB API that also serves the frontend

## Run locally
```
cd server
npm install
cp .env.example .env   # set MONGODB_URI and JWT_SECRET
npm start              # or `npm run local` for a built-in throwaway MongoDB
```
Open http://localhost:3000. Tests: `npm test`.

## Deploy (Render + MongoDB Atlas)
Root directory `server`, build `npm install --omit=dev`, start `npm start`,
env vars `MONGODB_URI` and `JWT_SECRET`.
