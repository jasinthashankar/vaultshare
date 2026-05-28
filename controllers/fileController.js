const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabaseClient');
const path = require('path');
const fs = require('fs');

const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { password, expiryHours, maxDownloads, selfDestruct, previewEnabled, accessType } = req.body;

    const token     = uuidv4().replace(/-/g, '').slice(0, 12);
    const passHash  = password ? await bcrypt.hash(password, 10) : null;
    const expiresAt = expiryHours
      ? new Date(Date.now() + parseInt(expiryHours) * 3600000).toISOString()
      : null;

    const publicId = `${uuidv4()}${path.extname(req.file.originalname)}`;

    const fileBuffer = new Uint8Array(req.file.buffer).buffer;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vaultshare')
      .upload(publicId, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('vaultshare')
      .getPublicUrl(publicId);

    const cloudUrl = publicUrlData.publicUrl;

    const { data: record, error } = await supabase
      .from('files')
      .insert([{
        token,
        uploader_id:     req.user.id,
        original_name:   req.file.originalname,
        cloud_url:       cloudUrl,
        public_id:       publicId,
        size:            req.file.size,
        mimetype:        req.file.mimetype,
        expires_at:      expiresAt,
        max_downloads:   maxDownloads ? parseInt(maxDownloads) : null,
        password_hash:   passHash,
        self_destruct:   selfDestruct === 'true' || selfDestruct === true,
        preview_enabled: previewEnabled === 'true' || previewEnabled === true,
        access_type:     accessType || 'other',
        has_password:    !!passHash,
        revoked:         false
      }])
      .select()
      .single();

    if (error) throw error;

    const shareLink = `${req.protocol}://${req.get('host')}/access/${token}`;

    res.json({
      success: true,
      token,
      shareLink,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        accessType: accessType || 'other',
        hasPassword: !!passHash,
        expiresAt,
        maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
        selfDestruct: selfDestruct === 'true' || selfDestruct === true,
        previewEnabled: previewEnabled === 'true' || previewEnabled === true,
      }
    });

  } catch (err) {
    console.error('[UPLOAD] ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

const getFiles = async (req, res) => {
  try {
    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .eq('uploader_id', req.user.id)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    const now = new Date();
    const mapped = (files || []).map(f => ({
      token:         f.token,
      originalName:  f.original_name,
      size:          formatBytes(f.size),
      downloadCount: f.download_count,
      maxDownloads:  f.max_downloads,
      expiresAt:     f.expires_at,
      hasPassword:   f.has_password,
      selfDestruct:  f.self_destruct,
      accessType:    f.access_type,
      revoked:       f.revoked,
      active:        !f.revoked && (!f.expires_at || new Date(f.expires_at) > now),
      uploadedAt:    f.uploaded_at,
    }));

    res.json({ files: mapped });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const revokeFile = async (req, res) => {
  try {
    const { error } = await supabase
      .from('files')
      .update({ revoked: true })
      .eq('token', req.params.token)
      .eq('uploader_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const restoreFile = async (req, res) => {
  try {
    const { error } = await supabase
      .from('files')
      .update({ revoked: false })
      .eq('token', req.params.token)
      .eq('uploader_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { data: f, error: findError } = await supabase
      .from('files')
      .select('*')
      .eq('token', req.params.token)
      .eq('uploader_id', req.user.id)
      .single();

    if (findError || !f) return res.status(404).json({ error: 'File not found' });

    if (f.public_id) {
      try {
        await supabase.storage.from('vaultshare').remove([f.public_id]);
        console.log('[DELETE] Supabase file removed:', f.public_id);
      } catch (err) {
        console.warn('[DELETE] Supabase file deletion failed:', err.message);
      }
    }

    const { error } = await supabase
      .from('files')
      .delete()
      .eq('token', req.params.token)
      .eq('uploader_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getFileInfo = async (req, res) => {
  try {
    const { data: f } = await supabase
      .from('files').select('*')
      .eq('token', req.params.token)
      .single();

    if (!f) return res.status(404).json({ error: 'File not found or link is invalid' });

    const now = new Date();
    if (f.revoked)     return res.status(403).json({ error: 'Access has been revoked by the owner' });
    if (f.expires_at && now > new Date(f.expires_at)) return res.status(410).json({ error: 'This link has expired' });
    if (f.max_downloads && f.download_count >= f.max_downloads) return res.status(410).json({ error: 'Download limit reached' });

    res.json({
      originalName:   f.original_name,
      name:           f.original_name,
      size:           f.size,
      mimetype:       f.mimetype,
      hasPassword:    f.has_password,
      previewEnabled: f.preview_enabled,
      accessType:     f.access_type,
      selfDestruct:   f.self_destruct,
      downloadCount:  f.download_count,
      maxDownloads:   f.max_downloads,
      expiresAt:      f.expires_at,
      uploadedAt:     f.uploaded_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const downloadFile = async (req, res) => {
  try {
    const { data: f } = await supabase
      .from('files').select('*')
      .eq('token', req.params.token)
      .single();

    if (!f) return res.status(404).json({ error: 'File not found' });

    const now = new Date();
    if (f.revoked)     return res.status(403).json({ error: 'Access revoked' });
    if (f.expires_at && now > new Date(f.expires_at)) return res.status(410).json({ error: 'Link expired' });
    if (f.max_downloads && f.download_count >= f.max_downloads) return res.status(410).json({ error: 'Limit reached' });

    if (f.has_password) {
      const ok = await bcrypt.compare(req.body.password || '', f.password_hash);
      if (!ok) return res.status(401).json({ error: 'Incorrect password' });
    }

    if (!req.body.reason) return res.status(400).json({ error: 'Access reason required' });
    if (f.access_type && f.access_type !== 'other' && req.body.reason !== f.access_type)
      return res.status(403).json({
        error: `This file is for "${f.access_type}" access only`,
        requiredAccessType: f.access_type
      });

    const ua = req.headers['user-agent'] || '';
    const device = /mobile|android|iphone/i.test(ua) ? 'mobile' : /tablet|ipad/i.test(ua) ? 'tablet' : 'desktop';

    await supabase.from('logs').insert([{
      file_token:  f.token,
      uploader_id: f.uploader_id,
      ip:          req.ip,
      device,
      reason:      req.body.reason,
      action:      'download'
    }]);

    await supabase.from('files').update({
      download_count: (f.download_count || 0) + 1,
      revoked: f.self_destruct ? true : f.revoked
    }).eq('token', f.token);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('vaultshare')
      .download(f.public_id);

    if (downloadError || !fileData) {
      console.error('[DOWNLOAD] Storage fetch error:', downloadError);
      return res.status(404).json({ error: 'File missing from server storage' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.original_name)}"`);
    res.setHeader('Content-Type', f.mimetype || 'application/octet-stream');
    res.send(buffer);

  } catch (err) {
    console.error('[DOWNLOAD] ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

const getAnalyticsOverview = async (req, res) => {
  try {
    const { data: myFiles } = await supabase
      .from('files').select('*').eq('uploader_id', req.user.id);

    const { data: myLogs } = await supabase
      .from('logs').select('*').eq('uploader_id', req.user.id);

    const now   = new Date();
    const files = myFiles || [];
    const logs  = myLogs  || [];

    const totalFiles     = files.length;
    const activeFiles    = files.filter(f => !f.revoked && (!f.expires_at || new Date(f.expires_at) > now)).length;
    const revokedFiles   = files.filter(f => f.revoked).length;
    const totalDownloads = files.reduce((s, f) => s + (f.download_count || 0), 0);

    const deviceBreakdown = { desktop: 0, mobile: 0, tablet: 0 };
    logs.forEach(l => { if (deviceBreakdown[l.device] !== undefined) deviceBreakdown[l.device]++; });

    const reasonBreakdown = { study: 0, work: 0, personal: 0, research: 0, other: 0 };
    logs.forEach(l => { if (reasonBreakdown[l.reason] !== undefined) reasonBreakdown[l.reason]++; });

    const downloadTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const day = d.toISOString().split('T')[0];
      const count = logs.filter(l => l.action === 'download' && l.accessed_at && l.accessed_at.startsWith(day)).length;
      downloadTrend.push({ date: day, count });
    }

    res.json({
      stats: {
        totalFiles, activeFiles, revokedFiles, totalDownloads,
        totalUploads: totalFiles,
        passwordProtected: files.filter(f => f.has_password).length,
        selfDestructFiles: files.filter(f => f.self_destruct).length
      },
      deviceBreakdown, reasonBreakdown, downloadTrend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAnalyticsLogs = async (req, res) => {
  try {
    const { data: logs } = await supabase
      .from('logs').select('*')
      .eq('uploader_id', req.user.id)
      .order('accessed_at', { ascending: false })
      .limit(50);

    res.json({
      logs: (logs || []).map(l => ({
        token:     l.file_token,
        filename:  l.file_token,
        ip:        l.ip,
        device:    l.device,
        reason:    l.reason,
        action:    l.action,
        timestamp: l.accessed_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  uploadFile,
  getFiles,
  revokeFile,
  restoreFile,
  deleteFile,
  getFileInfo,
  downloadFile,
  getAnalyticsOverview,
  getAnalyticsLogs
};
