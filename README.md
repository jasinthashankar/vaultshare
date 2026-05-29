# VaultShare — Smart Controlled File Sharing System

> A secure, full-stack file sharing web application with privacy controls, access enforcement, and real-time analytics.

---

## About the Project

VaultShare lets users upload files and share them via unique secure links — with full control over who can access them, how many times, and for how long. Every download is logged with the downloader's device type, IP address, and stated reason for access, giving the file owner a complete audit trail from their dashboard.

---

## Current Status

> **⚠️ In Development — Dual Architecture (Migration in Progress)**

The project currently contains **two parallel implementations** that were built at different stages:

| Layer | Legacy (SQLite/local) | Current (Supabase) |
|---|---|---|
| Database | `utils/db.js` (JSON flat-file via `vault.json`) | Supabase PostgreSQL |
| File Storage | Local `uploads/` folder | Supabase Storage (`vaultshare` bucket) |
| Auth Routes | `routes/auth.js` | `routes/authRoutes.js` → `controllers/authController.js` |
| File Routes | `routes/files.js`, `routes/access.js` | `routes/fileRoutes.js` → `controllers/fileController.js` |
| Analytics | `routes/analytics.js` | `routes/analyticsRoutes.js` |

`server.js` currently loads the **Supabase-based** controllers and routes. The legacy files (`routes/auth.js`, `routes/files.js`, `routes/access.js`, `routes/analytics.js`, `utils/db.js`) are still present but unused by the main server — they can be safely removed once the Supabase version is fully stable.

---

## Features (Implemented)

- **JWT Authentication** — Register and login with bcrypt-hashed passwords; tokens expire in 7 days
- **File Upload** — Multipart upload via Multer (memory storage), stored in Supabase Storage; 100MB limit; dangerous file types blocked (`.exe`, `.bat`, `.php`, etc.)
- **Secure Share Links** — Each file gets a unique 12-character token-based URL (`/access/:token`)
- **Password Protection** — Optional bcrypt-hashed password required before download
- **Expiry Control** — Set hour-based expiry; expired links return `410 Gone`
- **Download Limit** — Cap how many times a file can be downloaded
- **Self-Destruct** — Automatically revoke access after the first successful download
- **Access Type Enforcement** — Files tagged as `study / work / personal / research / other`; downloader's stated reason must match
- **Remote Revoke / Restore** — Owner can revoke or re-enable access from the dashboard instantly
- **Permanent Delete** — Removes the file from Supabase Storage and the database record
- **Access Logging** — Every download logs: IP address, device type (desktop/mobile/tablet), reason, timestamp
- **Analytics Dashboard** — Chart.js visualisations: download trend (7 days), device breakdown, reason breakdown, file stats
- **Rate Limiting** — Upload endpoint limited to 20 requests per 15 minutes
- **Health Check** — `GET /api/health` returns live user and file counts from Supabase
- **Responsive UI** — Glassmorphism dark theme across all pages

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| File Handling | Multer (memory storage) |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Charts | Chart.js (loaded via CDN) |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Dev Tool | Nodemon |

---

## Project Structure

```
smart-file-share/
├── server.js                   # App entry point, route registration
├── package.json
├── .env                        # Environment variables (not committed)
│
├── config/
│   └── supabaseClient.js       # Supabase client initialisation
│
├── controllers/
│   ├── authController.js       # register, login
│   └── fileController.js       # upload, list, revoke, restore, delete,
│                               #   getFileInfo, downloadFile, analytics
│
├── routes/
│   ├── authRoutes.js           # POST /api/auth/register, /login
│   ├── fileRoutes.js           # GET/POST /api/files/...
│   ├── analyticsRoutes.js      # GET /api/analytics/overview, /logs
│   │
│   │   ── Legacy (unused by server.js) ──
│   ├── auth.js
│   ├── files.js
│   ├── access.js
│   └── analytics.js
│
├── middleware/
│   ├── authMiddleware.js       # JWT verification (active)
│   ├── auth.js                 # Legacy JWT middleware
│   └── upload.js               # Multer config (memory, 100MB, type filter)
│
├── models/
│   ├── User.js                 # Mongoose schema (legacy, unused)
│   └── File.js                 # Mongoose schema (legacy, unused)
│
├── utils/
│   ├── db.js                   # JSON flat-file DB engine (legacy)
│   ├── helpers.js              # Token gen, formatBytes, IP/device utils
│   └── store.js                # Legacy store
│
├── data/
│   └── vault.json              # Local DB file (legacy)
│
├── uploads/                    # Local upload folder (legacy)
│
└── public/                     # Frontend static files
    ├── index.html              # Landing / upload page
    ├── login.html
    ├── register.html
    ├── dashboard.html          # File manager + analytics
    ├── access.html             # Download page (recipient view)
    ├── retrieve.html
    ├── script.js               # Frontend JS
    └── style.css               # Glassmorphism dark theme
```

---

## API Endpoints

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register with email + password |
| POST | `/api/auth/login` | — | Login, receive JWT |

### Files
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/files/upload` | ✅ | Upload a file with all settings |
| GET | `/api/files/list` | ✅ | List all files for logged-in user |
| POST | `/api/files/revoke/:token` | ✅ | Revoke access |
| POST | `/api/files/restore/:token` | ✅ | Restore revoked access |
| DELETE | `/api/files/:token` | ✅ | Permanently delete file |
| GET | `/api/files/info/:token` | — | Public file info (for recipient page) |
| POST | `/api/files/download/:token` | — | Download file (password + reason required) |

### Analytics
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/analytics/overview` | ✅ | Stats + device/reason charts data |
| GET | `/api/analytics/logs` | ✅ | Last 50 access log entries |

### System
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Supabase connectivity + counts |

---

## Supabase Schema (Required Tables)

### `users`
| Column | Type |
|---|---|
| `id` | uuid (PK) |
| `email` | text (unique) |
| `hash` | text |

### `files`
| Column | Type |
|---|---|
| `token` | text (PK) |
| `uploader_id` | uuid (FK → users) |
| `original_name` | text |
| `cloud_url` | text |
| `public_id` | text |
| `size` | int8 |
| `mimetype` | text |
| `expires_at` | timestamptz |
| `max_downloads` | int4 |
| `download_count` | int4 |
| `password_hash` | text |
| `has_password` | bool |
| `self_destruct` | bool |
| `preview_enabled` | bool |
| `access_type` | text |
| `revoked` | bool |
| `uploaded_at` | timestamptz |

### `logs`
| Column | Type |
|---|---|
| `id` | uuid (PK) |
| `file_token` | text |
| `uploader_id` | uuid |
| `ip` | text |
| `device` | text |
| `reason` | text |
| `action` | text |
| `accessed_at` | timestamptz |

---

## Local Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd smart-file-share
npm install
```

### 2. Configure `.env`

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=your_secret_key_here
PORT=3000
```

### 3. Run

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

App runs at `http://localhost:3000`

---

## Deployment (Render)

1. Push to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect the repository
4. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add all `.env` variables in the **Environment** tab
6. Deploy — Render provides a public URL

---

## Known Issues / TODO

- [ ] **Duplicate route files** — legacy routes (`auth.js`, `files.js`, `access.js`, `analytics.js`) and models (`User.js`, `File.js`) should be removed after confirming Supabase routes are stable
- [ ] **Duplicate middleware** — `middleware/auth.js` (legacy) and `middleware/authMiddleware.js` (active) coexist; the legacy one should be deleted
- [ ] **`test.html` and `test-pup.js`** — test files left in the repo; should be removed before production
- [ ] **`new-item.env`** — stray env file in root; remove before publishing
- [ ] **Mongoose models present but unused** — `mongoose` is still in `package.json` but no MongoDB connection exists in `server.js`; remove the dependency and model files
- [ ] **Analytics logs** don't display the actual filename — the logs table stores `file_token` but the dashboard shows the token instead of the original filename; needs a JOIN or lookup
- [ ] **No refresh token mechanism** — JWT expires after 7 days with no silent refresh; users get logged out abruptly
- [ ] **`access_type` mismatch** — legacy routes use `'official'` as a valid type but the Supabase controller uses `'other'` as the fallback; validation should be unified

---

## Author

**Jasintha S**
Final Year B.E. Computer Science Engineering
Anand Institute of Higher Technology, Kazhipattur, Chennai
