# SNAIL — AI Assistant Context

## What This App Is
**SNAIL** (Sn-AI-l Race) is a gamified social learning tracker for faculty participating in an "AI 101" course challenge: log 10 intentional hours using AI tools. Think Duolingo-meets-leaderboard.

## Project Constraints
- **Deployed on Equella** — static HTML/CSS/JS only, no server-side runtime
- **No paid database** — all data stored in Google Sheets via a Google Apps Script Web App API
- **Auth** — Google OAuth (Google Identity Services / GSI library)

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (single-page app) |
| Backend API | Google Apps Script Web App (`doGet` / `doPost`) |
| Database | Google Sheets (6 tabs) |
| Auth | Google OAuth 2.0 (GSI) |
| Hosting | Equella (static file host) |

## Folder Structure
```
snail/
├── index.html          # App shell (single page)
├── CLAUDE.md           # This file
├── README.md
├── css/
│   └── styles.css      # Duolingo-inspired fun theme
├── js/
│   ├── app.js          # Main app init + routing
│   ├── auth.js         # Google OAuth flow
│   ├── timer.js        # Clock in/out, time log CRUD
│   ├── journal.js      # Journal entries + feed
│   ├── leaderboard.js  # Cohort leaderboard
│   ├── badges.js       # Badge display + logic
│   └── admin.js        # Admin panel
└── apps-script/
    ├── Code.gs         # Router (doGet / doPost)
    ├── Auth.gs         # User management + roles
    ├── TimeLogs.gs     # Time log CRUD
    ├── Journal.gs      # Journal entry CRUD + feed
    ├── Badges.gs       # Badge computation
    ├── Cohorts.gs      # Cohort + join code management
    └── Admin.gs        # Admin-only operations
```

## Google Sheets Schema (6 tabs)
| Tab | Key Columns |
|-----|-------------|
| `users` | userId, email, name, photoUrl, role (user/admin), cohortId, joinDate |
| `cohorts` | cohortId, name, joinCode, createdBy, createdAt |
| `time_logs` | logId, userId, cohortId, startTime, endTime, durationMinutes, notes, isRetro, createdAt, updatedAt |
| `journal_entries` | entryId, userId, cohortId, content, isShared, createdAt, updatedAt |
| `badges` | badgeId, userId, badgeType, earnedAt |
| `feed` | feedId, entryId, userId, cohortId, preview, sharedAt |

## Badge Types
| Badge | Trigger |
|-------|---------|
| `hours_1` | 1 hour logged |
| `hours_5` | 5 hours logged |
| `hours_10` | 10 hours logged ("10 Hour Club") |
| `streak_5` | 5 consecutive work days (M–F) with a log |
| `weekend_warrior` | Any log on Saturday or Sunday |
| `posts_5` | 5 shared journal entries |
| `posts_10` | 10 shared journal entries |
| `posts_20` | 20 shared journal entries |

## Key App Behaviors
- **Leaderboard is cohort-scoped** — no global all-time board
- **All time logs are editable** — including retro (past-date) logs
- **Journal entries** are private by default; user can "share" to the community feed
- **Admin can see all entries** across all users
- **Cohort management**: admin creates cohort → gets join code → users enroll with code
- **Cohort wipe**: admin can export cohort CSV then confirm-delete
- **Snail mascot**: speeds up as user earns badges; sends passive-aggressive nudges when inactive
- **"10 Hour Club"** section separate from main leaderboard ranking

## Mascot / Branding
- Name: **SNAIL** (the AI is in the name: Sn-**AI**-l)
- Vibe: fun, colorful, Duolingo-inspired — NOT corporate/professional
- Snail character animates faster as badges are earned
- Passive-aggressive idle messages (e.g., "Still thinking about starting? Bold strategy.")

## Google Apps Script API Pattern
All frontend calls go to the deployed Web App URL via `fetch()`.
- `GET ?action=...&token=...` for read operations
- `POST` with JSON body `{ action, token, ...payload }` for writes
- Token = Google OAuth `id_token` passed on every request for server-side verification

## Owner / Admin
- Default admin: assigned by promoting a user within the app (no hardcoded emails)
- First admin setup: manually set `role = admin` in the `users` sheet for the owner's email
