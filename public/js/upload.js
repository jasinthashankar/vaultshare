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