// In-memory store (replace with a DB like SQLite/MongoDB for production)
const store = {
  files: new Map(),      // token => fileRecord
  accessLogs: [],        // array of access log entries
  stats: {
    totalUploads: 0,
    totalDownloads: 0,
    totalRevoked: 0,
  }
};

// File record structure:
// {
//   token: string,
//   originalName: string,
//   filename: string (stored filename),
//   size: number,
//   mimetype: string,
//   uploadedAt: Date,
//   expiresAt: Date | null,
//   maxDownloads: number | null,
//   downloadCount: number,
//   passwordHash: string | null,
//   selfDestruct: boolean,
//   revoked: boolean,
//   previewEnabled: boolean,
//   uploaderIp: string,
// }

module.exports = store;
