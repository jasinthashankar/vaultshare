# ⬡ VaultShare — Smart Controlled File Sharing System

A secure, intelligent file-sharing platform with privacy controls, real-time analytics, and access management.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16 or higher
- **npm** v7 or higher

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# OR for development (auto-reload)
npm run dev
```

Then open your browser at: **http://localhost:3000**

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Password Protection | Secure files with a password; only authorized users can download |
| 🔥 Self-Destruct | File is permanently revoked after the first download |
| ⏳ Time-Based Expiry | Set expiry from 1 hour to 30 days |
| 🔢 Download Limits | Cap how many times a file can be downloaded |
| 🚫 Remote Revoke | Instantly cut off access from the dashboard |
| 🧠 Access Reason | Recipients must state why they're downloading (Study / Work / Personal / Research / Other) |
| 👀 Real-Time Tracking | Every download logs IP address, device type, timestamp, and reason |
| 📊 Analytics Dashboard | Charts showing trends, device breakdown, and reason breakdown |
| 📱 Responsive Design | Works on desktop, tablet, and mobile |

---

## 📁 Project Structure

```
smart-file-share/
├── server.js                 # Express server entry point
├── package.json
├── routes/
│   ├── files.js              # Upload, list, revoke, delete endpoints
│   ├── access.js             # Download, verify password endpoints
│   └── analytics.js          # Overview stats and access logs
├── middleware/
│   └── upload.js             # Multer file upload config
├── utils/
│   ├── store.js              # In-memory data store
│   └── helpers.js            # Utility functions
├── public/
│   ├── index.html            # Upload page
│   ├── dashboard.html        # Analytics dashboard
│   ├── access.html           # File access/download page
│   ├── css/
│   │   ├── style.css         # Main styles
│   │   └── dashboard.css     # Dashboard styles
│   └── js/
│       ├── upload.js         # Upload page logic
│       ├── access.js         # Access page logic
│       └── dashboard.js      # Dashboard logic
└── uploads/                  # Stored files (auto-created)
```

---

## 🌐 Pages

| Page | URL | Description |
|---|---|---|
| Upload | `http://localhost:3000/` | Upload files and configure access |
| Dashboard | `http://localhost:3000/dashboard` | Analytics and file management |
| Access | `http://localhost:3000/access/:token` | Recipient download page |

---

## 🔌 API Reference

### Upload
`POST /api/files/upload`  
Form data: `file`, `password?`, `expiryHours?`, `maxDownloads?`, `selfDestruct?`, `previewEnabled?`

### File Info
`GET /api/files/info/:token`

### List All Files
`GET /api/files/list`

### Revoke Access
`POST /api/files/revoke/:token`

### Restore Access
`POST /api/files/restore/:token`

### Delete File
`DELETE /api/files/:token`

### Download
`POST /f/download/:token`  
Body: `{ reason, password? }`

### Analytics Overview
`GET /api/analytics/overview`

### Access Logs
`GET /api/analytics/logs?limit=50`

---

## ⚙️ Configuration

Edit `server.js` to change:
- `PORT` (default: 3000)
- Session secret
- Rate limits

Edit `middleware/upload.js` to change:
- Max file size (default: 100MB)
- Blocked file types

---

## 📦 Production Notes

- **Storage**: This implementation uses in-memory storage. Data is lost when the server restarts. For production, integrate a database (SQLite, MongoDB, PostgreSQL).
- **File Storage**: Files are stored in `/uploads`. For production, consider S3 or another cloud storage.
- **HTTPS**: Deploy behind a reverse proxy (nginx) with SSL for production use.
- **Session Secret**: Change the session secret in `server.js` to a strong random value.

---

## 🛡️ Security

- File types filtered (executables blocked)
- Rate limiting on upload and access routes
- Password hashing with bcrypt (cost factor 10)
- Helmet.js security headers
- File access validated on every request (expiry, revoke, limits)

---

*Built with Node.js · Express · Multer · Chart.js*
