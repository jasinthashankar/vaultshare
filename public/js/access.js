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