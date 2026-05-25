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
