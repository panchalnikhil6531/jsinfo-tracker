# JavaScript.info Progress Tracker

Track your progress through the [javascript.info](https://javascript.info) curriculum, keep notes per lesson, and compare progress with others on a community leaderboard.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?logo=mongodb&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20(MV3)-4285F4?logo=googlechrome&logoColor=white)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-46E3B7?logo=render&logoColor=white)](https://jsinfo-tracker.onrender.com/)

## Live Demo

**[jsinfo-tracker.onrender.com](https://jsinfo-tracker.onrender.com/)**

> If hosted on Render's free tier, the first request after a period of inactivity may take a little while as the server wakes up.

## Overview

javascript.info is one of the best free JavaScript tutorials, but it has no built-in way to track what you have read. This project adds that layer: every lesson from Part 1 (The JavaScript language), Part 2 (Browser: Document, Events, Interfaces) and Part 3 (Additional articles) is listed in a single dashboard where you can mark it as in progress or done, write notes, and see your statistics.

Progress is stored per account in MongoDB, so it follows you across devices. A community page shows how everyone else is doing, and an optional Chrome extension marks lessons automatically while you read them on javascript.info.

## Features

**Tracker**
- Full javascript.info curriculum grouped by part and chapter, with links to every lesson
- Per-lesson status: To do, In progress, Done (opening a lesson link marks it in progress)
- Private notes for each lesson
- "Mark all done" / "Undo all" per chapter
- Search (press `/` to focus, `Esc` to clear) and filters by status or lessons with notes
- Expand / collapse all chapters
- Stats cards: completed, in progress, this week, current streak, best streak, and an estimated finish time based on your pace over the last 14 days
- Activity heatmap covering the last 15 weeks
- Export progress to JSON and import it back
- Light / dark theme
- Reset all progress, or permanently delete your account (password required)

**Accounts and community**
- Register / log in with email and password (bcrypt-hashed passwords, JWT sessions valid for 30 days)
- Community leaderboard ranked by lessons completed, then lessons in progress
- Read-only view of any user's progress; emails and notes are never exposed to other users

**Chrome extension (`extension/`)**
- Opening a javascript.info lesson marks it in progress (unless it is already done)
- Clicking "Next lesson" (or pressing `Ctrl + Right Arrow`) marks the current lesson done
- Popup with login, overall progress, the lesson on the current page and the last sync
- Toolbar badge shows `!` when you need to log in again or the server is unreachable

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js (>= 18), Express 5 |
| Database | MongoDB with Mongoose 8 |
| Auth | bcryptjs, jsonwebtoken (JWT) |
| Extension | Chrome Manifest V3 (service worker + content script) |
| Testing / local DB | mongodb-memory-server |
| Hosting | Render (web service) + MongoDB Atlas |

## Project Structure

```
jsinfo-tracker/
├── public/               # Frontend, served statically by Express
│   ├── index.html        # Tracker dashboard
│   ├── login.html        # Login / register
│   ├── community.html    # Leaderboard
│   ├── user.html         # Read-only view of another user's progress
│   ├── app.js            # Dashboard logic (stats, heatmap, search, import/export)
│   ├── api.js            # Fetch wrapper + auth token handling
│   ├── data.js           # javascript.info curriculum (titles and slugs)
│   └── style.css
├── server/               # Express + MongoDB API
│   ├── index.js          # Entry point: connects to MongoDB and starts the server
│   ├── app.js            # Express app (routes, static files, error handler)
│   ├── dev.js            # Runs with a throwaway local MongoDB (no install needed)
│   ├── middleware.js     # JWT auth middleware
│   ├── models/           # User, Progress
│   ├── routes/           # auth, progress, users
│   ├── test.js           # End-to-end API tests
│   └── .env.example
├── extension/            # Chrome extension that syncs lessons automatically
└── render.yaml           # Render blueprint
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A MongoDB database (local install or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster). Not required if you use `npm run local`.

### Installation

```bash
git clone https://github.com/panchalnikhil6531/jsinfo-tracker.git
cd jsinfo-tracker/server
npm install
cp .env.example .env
```

### Environment Variables

Set these in `server/.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | Yes | Long random string used to sign login tokens |
| `PORT` | No | Port to listen on (defaults to `3000`) |

### Run

Run these from the `server/` directory:

| Command | Description |
| --- | --- |
| `npm start` | Start the server using `MONGODB_URI` |
| `npm run dev` | Start with `node --watch` (auto-restart on changes) |
| `npm run local` | Start with a built-in throwaway MongoDB stored in `server/.data` (no MongoDB install needed) |
| `npm test` | Run end-to-end API tests against an in-memory MongoDB |

Then open [http://localhost:3000](http://localhost:3000).

### Chrome Extension (optional)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Open the extension popup, enter your tracker URL (for example `https://jsinfo-tracker.onrender.com`), and log in.

If you edit the curriculum in `public/data.js`, regenerate the extension's lesson list with `node extension/generate-lessons.js`.

## API Endpoints

All API routes are under `/api`. Endpoints marked "Yes" require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Create an account (`name`, `email`, `password`); returns a token and user |
| `POST` | `/api/auth/login` | No | Log in with `email` and `password`; returns a token and user |
| `GET` | `/api/auth/me` | Yes | Get the current user |
| `DELETE` | `/api/auth/me` | Yes | Delete the account and all its progress (requires `password` in the body) |
| `GET` | `/api/progress` | Yes | Get your progress as `{ [slug]: { status, note, at } }` |
| `PUT` | `/api/progress/:slug` | Yes | Set `status` (`todo`, `learning`, `done`) and/or `note` for one lesson |
| `DELETE` | `/api/progress` | Yes | Reset all of your progress and notes |
| `GET` | `/api/users` | Yes | Community leaderboard (name, done, learning, last active) |
| `GET` | `/api/users/:id/progress` | Yes | Another user's progress (read-only, without notes) |
| `GET` | `/health` | No | Health check |

## Deployment

The app is deployed on **Render** with **MongoDB Atlas** as the database. The included `render.yaml` blueprint configures:

- Root directory: `server`
- Build command: `npm install --omit=dev`
- Start command: `npm start`
- Environment variables: `MONGODB_URI` (set manually in the Render dashboard) and `JWT_SECRET` (generated by Render)

Express serves both the API and the static frontend from `public/`, so a single web service is all that is needed.

## Author

**Panchal Nikhil S**

- GitHub: [@panchalnikhil6531](https://github.com/panchalnikhil6531)
- LinkedIn: [Nikhil S Panchal](https://www.linkedin.com/in/nikhil-s-panchal-463a78319/)
- Portfolio: [potfolio-beta-two.vercel.app](https://potfolio-beta-two.vercel.app/)
