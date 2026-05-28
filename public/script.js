
/* --- access.js --- */
if (window.location.pathname.startsWith('/access/')) {
  (function() {
/* VaultShare — Access Page Logic (with Access Type Enforcement) */

const token = window.location.pathname.split('/access/')[1];
const loadingCard = document.getElementById('loadingCard');
const errorCard = document.getElementById('errorCard');
const mainCard = document.getElementById('mainCard');
const errorTitle = document.getElementById('errorTitle');
const errorDesc = document.getElementById('errorDesc');
const fileTitle = document.getElementById('fileTitle');
const fileTypeBadge = document.getElementById('fileTypeBadge');
const fileSize = document.getElementById('fileSize');
const fileTypeEl = document.getElementById('fileType');
const fileStatus = document.getElementById('fileStatus');
const accessMeta = document.getElementById('accessMeta');
const passwordGroup = document.getElementById('passwordGroup');
const reasonGroup = document.getElementById('reasonGroup');
const accessPassword = document.getElementById('accessPassword');
const selectedReason = document.getElementById('selectedReason');
const downloadBtn = document.getElementById('downloadBtn');
const downloadHint = document.getElementById('downloadHint');
const selfDestructWarning = document.getElementById('selfDestructWarning');

let fileInfo = null;

const ACCESS_TYPE_META = {
  official: { label: '🏛️ Official Use',  desc: 'This file is designated for official use only.' },
  work:     { label: '💼 Work',           desc: 'This file is intended for work-related purposes.' },
  study:    { label: '📚 Study',          desc: 'This file is shared for educational / study purposes.' },
  personal: { label: '🏠 Personal',       desc: 'This file is shared for personal use.' },
  research: { label: '🔬 Research',       desc: 'This file is intended for research purposes.' },
  other:    { label: '💬 Other',          desc: 'This file has a custom/general access purpose.' },
};

function getFileExt(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
}

function showError(title, desc) {
  loadingCard.classList.add('hidden');
  mainCard.classList.add('hidden');
  errorCard.classList.remove('hidden');
  errorTitle.textContent = title;
  errorDesc.textContent = desc;
}

function updateDownloadBtn() {
  const hasReason = !!selectedReason.value;
  const needsPassword = fileInfo?.hasPassword && !accessPassword.value.trim();
  const reasonMatches = !fileInfo?.accessType || selectedReason.value === fileInfo.accessType;

  downloadBtn.disabled = !hasReason || needsPassword || !reasonMatches;

  if (!hasReason) {
    downloadHint.textContent = fileInfo?.accessType
      ? `You must confirm this is for "${ACCESS_TYPE_META[fileInfo.accessType]?.label || fileInfo.accessType}" use`
      : 'Select an access reason to continue';
    downloadHint.style.color = '';
  } else if (!reasonMatches) {
    downloadHint.textContent = `❌ Wrong access type. This file requires "${ACCESS_TYPE_META[fileInfo.accessType]?.label || fileInfo.accessType}"`;
    downloadHint.style.color = '#e57373';
  } else if (needsPassword) {
    downloadHint.textContent = 'Enter the correct password to continue';
    downloadHint.style.color = '';
  } else {
    downloadHint.textContent = '✓ Access confirmed — click Download File to start';
    downloadHint.style.color = 'var(--accent)';
  }
}

function buildReasonButtons(requiredType) {
  const grid = document.querySelector('.reason-grid');
  grid.innerHTML = '';

  Object.entries(ACCESS_TYPE_META).forEach(([type, meta]) => {
    const btn = document.createElement('button');
    btn.className = 'reason-btn';
    btn.dataset.reason = type;
    btn.textContent = meta.label;

    if (requiredType && type !== requiredType) {
      btn.disabled = true;
      btn.style.opacity = '0.3';
      btn.style.cursor = 'not-allowed';
      btn.title = `This file does not allow "${meta.label}" access`;
    }

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedReason.value = type;
      updateDownloadBtn();
    });

    grid.appendChild(btn);
  });
}

async function loadFileInfo() {
  if (!token) return showError('Invalid Link', 'This link does not appear to be valid.');

  try {
    const res = await fetch(`/api/files/info/${token}`);
    const data = await res.json();

    if (!res.ok) return showError('File Not Found', data.error || 'This file could not be found.');
    if (data.revoked) return showError('Access Revoked', 'The owner has revoked access to this file.');
    if (data.expired) return showError('Link Expired', 'This file link has expired and is no longer accessible.');
    if (data.limitReached) return showError('Download Limit Reached', 'This file has reached its maximum number of downloads.');

    fileInfo = data;

    fileTitle.textContent = data.originalName;
    fileTypeBadge.textContent = getFileExt(data.originalName);
    fileSize.textContent = data.size;
    fileTypeEl.textContent = data.mimetype || 'Unknown';

    const metas = [
      { label: 'Uploaded', val: new Date(data.uploadedAt).toLocaleDateString() },
      { label: 'Downloads', val: data.downloadCount + (data.maxDownloads ? `/${data.maxDownloads}` : '') },
      { label: 'Expires', val: data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : 'Never' },
      { label: 'Protected', val: data.hasPassword ? '🔐 Yes' : 'No' },
    ];
    accessMeta.innerHTML = metas.map(m =>
      `<div class="meta-item"><div class="meta-label">${m.label}</div><div class="meta-val">${m.val}</div></div>`
    ).join('');

    // ACCESS TYPE BANNER
    if (data.accessType) {
      const meta = ACCESS_TYPE_META[data.accessType] || { label: data.accessType, desc: '' };
      const banner = document.createElement('div');
      banner.style.cssText = `
        background: rgba(0,230,118,0.08);
        border: 1px solid rgba(0,230,118,0.3);
        border-radius: 10px;
        padding: 0.9rem 1.1rem;
        margin-bottom: 1.2rem;
        font-size: 0.85rem;
      `;
      banner.innerHTML = `
        <div style="font-weight:700;color:var(--accent);margin-bottom:0.2rem;font-size:0.95rem">
          🎯 Access Type: ${meta.label}
        </div>
        <div style="color:var(--text-muted)">${meta.desc}</div>
        <div style="color:var(--text-muted);margin-top:0.35rem;font-size:0.78rem">
          ⚠ You must confirm the correct access type below to unlock this download.
        </div>
      `;
      reasonGroup.insertBefore(banner, reasonGroup.firstChild);
    }

    const reasonLabel = reasonGroup.querySelector('.form-label');
    if (data.accessType) {
      reasonLabel.innerHTML = `🔒 Confirm access type to unlock download`;
    } else {
      reasonLabel.innerHTML = `🧠 Why are you accessing this file?`;
    }

    buildReasonButtons(data.accessType || null);

    if (data.hasPassword) passwordGroup.classList.remove('hidden');
    if (data.selfDestruct) selfDestructWarning.classList.remove('hidden');

    loadingCard.classList.add('hidden');
    mainCard.classList.remove('hidden');
    updateDownloadBtn();
  } catch (err) {
    showError('Connection Error', 'Failed to load file information. Please try again.');
  }
}

accessPassword.addEventListener('input', () => updateDownloadBtn());

downloadBtn.addEventListener('click', async () => {
  if (!selectedReason.value) return;

  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ Preparing…';

  const body = { reason: selectedReason.value };
  if (fileInfo?.hasPassword) body.password = accessPassword.value;

  try {
    const res = await fetch(`/f/download/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      if (res.status === 401) {
        alert('❌ Incorrect password. Please try again.');
        accessPassword.value = '';
        accessPassword.focus();
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇ Download File';
        updateDownloadBtn();
        return;
      }
      if (res.status === 403 && err.requiredAccessType) {
        alert(`🚫 Access Denied\n\nThis file is restricted to "${ACCESS_TYPE_META[err.requiredAccessType]?.label || err.requiredAccessType}" use only.`);
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇ Download File';
        return;
      }
      throw new Error(err.error || 'Download failed');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileInfo.originalName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);

    downloadBtn.textContent = '✓ Downloaded!';
    downloadHint.textContent = '✅ Your download has started successfully';
    downloadHint.style.color = 'var(--accent)';

    if (fileInfo.selfDestruct) {
      setTimeout(() => {
        showError('File Self-Destructed', 'This file has been permanently deleted after your download.');
      }, 2000);
    }
  } catch (err) {
    alert(err.message || 'Download failed');
    downloadBtn.disabled = false;
    downloadBtn.textContent = '⬇ Download File';
  }
});

loadFileInfo();
  })();
}

/* --- dashboard.js --- */
if (window.location.pathname === '/dashboard') {
  (function() {
// Auth guard
(function() {
  const t = localStorage.getItem('vaultToken');
  if (!t) { window.location.href = '/login'; }
})();

function authHeaders() {
  return { 'Authorization': 'Bearer ' + (localStorage.getItem('vaultToken') || '') };
}

function logout() {
  localStorage.removeItem('vaultToken');
  localStorage.removeItem('vaultUser');
  window.location.href = '/login';
}

/* VaultShare — Dashboard Logic */

let allFiles = [];
let currentFilter = 'all';
let pendingRevoke = null;
let trendChart, deviceChart, reasonChart;

// ---- CHARTS INIT ----
function initCharts() {
  try {
    const baseOpts = {
      responsive: true,
      plugins: { legend: { display: false } },
    };
    const gridColor = 'rgba(255,255,255,0.06)';
    const fontColor = '#9090a8';

    // Trend chart
    trendChart = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#00ff88', pointRadius: 4 }] },
      options: { ...baseOpts, scales: {
        x: { ticks: { color: fontColor, font: { family: 'Space Mono', size: 10 } }, grid: { color: gridColor } },
        y: { ticks: { color: fontColor, font: { family: 'Space Mono', size: 10 }, stepSize: 1 }, grid: { color: gridColor } },
      }},
    });

    // Device chart
    deviceChart = new Chart(document.getElementById('deviceChart'), {
      type: 'doughnut',
      data: {
        labels: ['Desktop', 'Mobile', 'Tablet'],
        datasets: [{ data: [0, 0, 0], backgroundColor: ['#4488ff', '#00ff88', '#cc44ff'], borderWidth: 0, hoverOffset: 4 }]
      },
      options: { ...baseOpts, plugins: { legend: { display: true, position: 'bottom', labels: { color: fontColor, font: { family: 'Space Mono', size: 10 }, padding: 12 } } } },
    });

    // Reason chart
    reasonChart = new Chart(document.getElementById('reasonChart'), {
      type: 'doughnut',
      data: {
        labels: ['Study', 'Work', 'Personal', 'Research', 'Other'],
        datasets: [{ data: [0, 0, 0, 0, 0], backgroundColor: ['#00ff88', '#4488ff', '#ffcc00', '#cc44ff', '#ff8844'], borderWidth: 0, hoverOffset: 4 }]
      },
      options: { ...baseOpts, plugins: { legend: { display: true, position: 'bottom', labels: { color: fontColor, font: { family: 'Space Mono', size: 10 }, padding: 8 } } } },
    });
  } catch (err) {
    console.error('Failed to initialize charts:', err);
  }
}

// ---- FETCH DATA ----
async function fetchAll() {
  try {
    const [overviewRes, filesRes, logsRes] = await Promise.all([
      fetch('/api/analytics/overview', { headers: authHeaders() }),
      fetch('/api/files/list', { headers: authHeaders() }),
      fetch('/api/analytics/logs?limit=50', { headers: authHeaders() }),
    ]);
    const overview = await overviewRes.json();
    const filesData = await filesRes.json();
    const logsData = await logsRes.json();

    updateStats(overview.stats);
    updateCharts(overview);
    allFiles = filesData.files || [];
    renderFiles();
    renderLogs(logsData.logs || []);
  } catch (err) {
    console.error('Dashboard fetch error:', err);
  }
}

function updateStats(stats) {
  document.getElementById('statUploads').textContent = stats.totalUploads;
  document.getElementById('statDownloads').textContent = stats.totalDownloads;
  document.getElementById('statActive').textContent = stats.activeFiles;
  document.getElementById('statRevoked').textContent = stats.revokedFiles;
  document.getElementById('statPassword').textContent = stats.passwordProtected;
  document.getElementById('statSelfDestruct').textContent = stats.selfDestructFiles;
}

function updateCharts(data) {
  try {
    // Trend
    const trend = data.downloadTrend || [];
    trendChart.data.labels = trend.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    });
    trendChart.data.datasets[0].data = trend.map(d => d.count);
    trendChart.update();

    // Device
    const dev = data.deviceBreakdown || {};
    deviceChart.data.datasets[0].data = [dev.desktop || 0, dev.mobile || 0, dev.tablet || 0];
    deviceChart.update();

    // Reason
    const reasons = data.reasonBreakdown || {};
    reasonChart.data.datasets[0].data = [
      reasons.study || 0, reasons.work || 0, reasons.personal || 0, reasons.research || 0, reasons.other || 0
    ];
    reasonChart.update();
  } catch (err) {
    console.error('Failed to update charts:', err);
  }
}

// ---- FILES TABLE ----
function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { pdf: '📕', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', mp4: '🎬', mp3: '🎵', zip: '🗜️', rar: '🗜️', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', txt: '📄' };
  return map[ext] || '📦';
}

function getStatusBadge(file) {
  if (file.revoked) return `<span class="status-badge revoked">Revoked</span>`;
  if (!file.active) return `<span class="status-badge expired">Expired</span>`;
  return `<span class="status-badge active">Active</span>`;
}

function renderFiles() {
  const tbody = document.getElementById('filesBody');
  let files = allFiles;

  if (currentFilter === 'active') files = files.filter(f => f.active);
  else if (currentFilter === 'revoked') files = files.filter(f => f.revoked);

  if (!files.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">${currentFilter === 'all' ? 'No files uploaded yet. <a href="/" style="color:var(--accent)">Upload one →</a>' : 'No files match this filter'}</td></tr>`;
    return;
  }

  tbody.innerHTML = files.map(f => {
    const expiry = f.expiresAt ? new Date(f.expiresAt).toLocaleDateString() : '—';
    const shareUrl = `${window.location.origin}/access/${f.token}`;
    return `
      <tr data-token="${f.token}">
        <td>
          <div class="file-cell">
            <div class="file-cell-icon">${getFileIcon(f.originalName)}</div>
            <div>
              <div class="file-cell-name" title="${f.originalName}">${f.originalName}</div>
              <div class="file-cell-token">${f.token}</div>
            </div>
          </div>
        </td>
        <td>${f.size}</td>
        <td><span class="count-badge">${f.downloadCount}${f.maxDownloads ? `/${f.maxDownloads}` : ''}</span></td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text2)">${expiry}</td>
        <td>${getStatusBadge(f)}</td>
        <td>
          <div class="actions-cell">
            <button class="action-btn copy" onclick="copyLink('${shareUrl}')">Copy Link</button>
            ${f.revoked
              ? `<button class="action-btn restore" onclick="restoreFile('${f.token}')">Restore</button>`
              : `<button class="action-btn revoke" onclick="openRevoke('${f.token}')">Revoke</button>`
            }
            <button class="action-btn delete" onclick="deleteFile('${f.token}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---- LOGS TABLE ----
function getDeviceIcon(device) {
  if (device === 'mobile') return '📱';
  if (device === 'tablet') return '💻';
  return '🖥️';
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderLogs(logs) {
  const tbody = document.getElementById('logsBody');
  document.getElementById('logCount').textContent = `${logs.length} events`;

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No access events recorded yet</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:0.82rem;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${log.filename}">${log.filename}</div>
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text2)">${log.token}</div>
      </td>
      <td><span class="time-text">${timeAgo(log.timestamp)}</span></td>
      <td><span class="ip-text">${log.ip}</span></td>
      <td><span class="device-icon">${getDeviceIcon(log.device)}</span>${log.device}</td>
      <td><span class="reason-label">${log.reason}</span></td>
    </tr>
  `).join('');
}

// ---- ACTIONS ----
function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    // Flash feedback
    const el = event.target;
    const orig = el.textContent;
    el.textContent = 'Copied!';
    el.style.borderColor = 'var(--accent)';
    el.style.color = 'var(--accent)';
    setTimeout(() => { el.textContent = orig; el.style.borderColor = ''; el.style.color = ''; }, 1500);
  });
}

function openRevoke(token) {
  pendingRevoke = token;
  document.getElementById('revokeModal').classList.remove('hidden');
}

document.getElementById('cancelRevoke').addEventListener('click', () => {
  pendingRevoke = null;
  document.getElementById('revokeModal').classList.add('hidden');
});

document.getElementById('confirmRevoke').addEventListener('click', async () => {
  if (!pendingRevoke) return;
  try {
    await fetch(`/api/files/revoke/${pendingRevoke}`, { method: 'POST', headers: authHeaders() });
    document.getElementById('revokeModal').classList.add('hidden');
    pendingRevoke = null;
    fetchAll();
  } catch (err) { alert('Failed to revoke access'); }
});

async function restoreFile(token) {
  try {
    await fetch(`/api/files/restore/${token}`, { method: 'POST', headers: authHeaders() });
    fetchAll();
  } catch (err) { alert('Failed to restore access'); }
}

async function deleteFile(token) {
  if (!confirm('Permanently delete this file? This cannot be undone.')) return;
  try {
    await fetch(`/api/files/${token}`, { method: 'DELETE', headers: authHeaders() });
    fetchAll();
  } catch (err) { alert('Failed to delete file'); }
}

// ---- FILTERS ----
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderFiles();
  });
});

// ---- REFRESH ----
document.getElementById('refreshBtn').addEventListener('click', () => {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('refreshing');
  fetchAll().then(() => setTimeout(() => btn.classList.remove('refreshing'), 500));
});

// ---- INIT ----
initCharts();
fetchAll();

// Auto-refresh every 15s
setInterval(fetchAll, 15000);

  })();
}

/* --- upload.js --- */
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
  (function() {
// Auth guard — redirect to login if not logged in
(function() {
  if (!localStorage.getItem('vaultToken')) {
    window.location.href = '/login';
  }
})();

/* VaultShare — Upload Page Logic */

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fpName = document.getElementById('fpName');
const fpMeta = document.getElementById('fpMeta');
const fpIcon = document.getElementById('fpIcon');
const fpRemove = document.getElementById('fpRemove');
const toStep2 = document.getElementById('toStep2');
const backToStep1 = document.getElementById('backToStep1');
const uploadBtn = document.getElementById('uploadBtn');
const uploadBtnText = document.getElementById('uploadBtnText');
const uploadProgress = document.getElementById('uploadProgress');
const enablePassword = document.getElementById('enablePassword');
const passwordField = document.getElementById('passwordField');
const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');
const fileBadges = document.getElementById('fileBadges');
const selectedAccessType = document.getElementById('selectedAccessType');
const accessTypeHint = document.getElementById('accessTypeHint');
const uploadBtnRef = document.getElementById('uploadBtn');

let selectedFile = null;

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type = '') {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📕';
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return '🗜️';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('text')) return '📄';
  return '📦';
}

function selectFile(file) {
  selectedFile = file;
  fpName.textContent = file.name;
  fpMeta.textContent = `${formatBytes(file.size)} · ${file.type || 'Unknown type'}`;
  fpIcon.textContent = getFileIcon(file.type);
  dropzone.classList.add('hidden');
  filePreview.classList.remove('hidden');
  toStep2.disabled = false;
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
  dropzone.classList.remove('hidden');
  toStep2.disabled = true;
}

// Dropzone events
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) selectFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) selectFile(fileInput.files[0]);
});
fpRemove.addEventListener('click', clearFile);

// Access type selection
const ACCESS_TYPE_LABELS = {
  official: '🏛️ Official Use', work: '💼 Work', study: '📚 Study',
  personal: '🏠 Personal', research: '🔬 Research', other: '💬 Other'
};

document.querySelectorAll('#accessTypeGrid .reason-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#accessTypeGrid .reason-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedAccessType.value = btn.dataset.type;
    accessTypeHint.style.color = 'var(--accent)';
    accessTypeHint.textContent = `✓ Receivers must confirm "${ACCESS_TYPE_LABELS[btn.dataset.type]}" to download`;
    uploadBtnRef.disabled = false;
  });
});

// Block "Generate Secure Link" until access type is chosen
uploadBtnRef.disabled = true;

// Step navigation
function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

toStep2.addEventListener('click', () => {
  showStep('step2');
  uploadBtnRef.disabled = !selectedAccessType.value;
});
backToStep1.addEventListener('click', () => showStep('step1'));

// Toggle password field
enablePassword.addEventListener('change', () => {
  passwordField.classList.toggle('hidden', !enablePassword.checked);
  if (!enablePassword.checked) document.getElementById('password').value = '';
});

// Upload
uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const accessType = selectedAccessType.value;
  const password = document.getElementById('password').value;
  const expiryHours = document.getElementById('expiryHours').value;
  const maxDownloads = document.getElementById('maxDownloads').value;
  const selfDestruct = document.getElementById('selfDestruct').checked;
  const previewEnabled = document.getElementById('previewEnabled').checked;

  if (!accessType) {
    alert('Please select an Access Type before generating the link.');
    return;
  }

  if (enablePassword.checked && !password) {
    alert('Please enter a password or disable password protection.');
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('accessType', accessType);
  if (enablePassword.checked && password) formData.append('password', password);
  if (expiryHours) formData.append('expiryHours', expiryHours);
  if (maxDownloads) formData.append('maxDownloads', maxDownloads);
  formData.append('selfDestruct', selfDestruct);
  formData.append('previewEnabled', previewEnabled);

  uploadBtnText.classList.add('hidden');
  uploadProgress.classList.remove('hidden');
  uploadBtn.disabled = true;

  try {
    const token = localStorage.getItem('vaultToken');
    const res = await fetch('/api/files/upload', { method: 'POST', body: formData, headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Upload failed');

    shareLink.textContent = data.shareLink;

    fileBadges.innerHTML = '';
    const badges = [];
    badges.push({ label: data.file.size, active: false });
    badges.push({ label: `🎯 ${ACCESS_TYPE_LABELS[data.file.accessType] || data.file.accessType}`, active: true });
    if (data.file.hasPassword) badges.push({ label: '🔐 Password', active: true });
    if (data.file.expiresAt) badges.push({ label: `⏳ Expires ${new Date(data.file.expiresAt).toLocaleString()}`, active: true });
    if (data.file.maxDownloads) badges.push({ label: `🔢 Max ${data.file.maxDownloads} downloads`, active: true });
    if (data.file.selfDestruct) badges.push({ label: '🔥 Self-destruct', active: true });
    if (data.file.previewEnabled) badges.push({ label: '👁 Preview on', active: false });

    badges.forEach(b => {
      const span = document.createElement('span');
      span.className = `badge-item${b.active ? ' active' : ''}`;
      span.textContent = b.label;
      fileBadges.appendChild(span);
    });

    showStep('step3');
  } catch (err) {
    alert(err.message || 'Upload failed');
  } finally {
    uploadBtnText.classList.remove('hidden');
    uploadProgress.classList.add('hidden');
    uploadBtn.disabled = false;
  }
});

// Copy link
copyBtn.addEventListener('click', () => {
  const url = shareLink.textContent;
  navigator.clipboard.writeText(url).then(() => {
    copyBtn.textContent = '✓';
    setTimeout(() => { copyBtn.textContent = '⎘'; }, 2000);
  });
});
  })();
}
