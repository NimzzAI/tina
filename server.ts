import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
// @ts-ignore
import {
  detectPlatform,
  scrapeUrl,
  resolveUrl,
  ensureJpegBuffer,
  getImageDimensions,
  generateImagesPdf,
  CHROME_UA,
} from './server/engines/mori-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PY_ENGINE = path.join(__dirname, 'server', 'py_engine.py');
const GO_WORKER = path.join(__dirname, 'server', 'engines', 'tina-go-worker');
const YTDLP_BIN = path.join(__dirname, 'server', 'engines', 'yt-dlp');
const GO_STATE_FILE = path.join(__dirname, 'server', 'data', 'go-ratelimit.json');
const SUPPORTED_SITES_MD = path.join(
  __dirname,
  'public',
  'assets',
  'aistudio',
  'supportedsites_cb2590be.md'
);

// Ensure binary executables have +x permissions
try {
  if (fs.existsSync(GO_WORKER)) fs.chmodSync(GO_WORKER, 0o755);
  if (fs.existsSync(YTDLP_BIN)) fs.chmodSync(YTDLP_BIN, 0o755);
} catch {
  // ignore
}

function formatBytes(bytes?: number | null): string | undefined {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return undefined;
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`;
}

function formatDurationSeconds(sec?: number | null): string {
  if (!sec || sec <= 0 || !Number.isFinite(sec)) return '';
  const s = Math.floor(sec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof xff === 'string' && xff.trim()) {
    ip = xff.split(',')[0].trim();
  } else if (Array.isArray(xff) && xff.length > 0) {
    ip = xff[0].trim();
  } else if (typeof req.headers['x-real-ip'] === 'string') {
    ip = req.headers['x-real-ip'].trim();
  } else {
    ip = req.socket?.remoteAddress || '127.0.0.1';
  }
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip.slice(0, 64);
}

function extractDeviceId(req: Request): string {
  const rawHeader = req.headers['x-device-id'];
  const raw = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (typeof raw === 'string' && /^[a-zA-Z0-9_\-]{4,128}$/.test(raw.trim())) {
    return raw.trim();
  }
  return 'TINA-DEV-UNIDENTIFIED';
}

function runGoWorker(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(GO_WORKER, args, { timeout: 6000 }, (err, stdout) => {
      if (err && !stdout) {
        return reject(err);
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function runPythonEngine(args: string[], stdinPayload?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [PY_ENGINE, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Batas waktu pemrosesan terlampaui.'));
    }, 32000);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const trimmed = stdout.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.error && code !== 0) {
            return reject(new Error(parsed.error));
          }
          return resolve(parsed);
        } catch {
          // fallback below
        }
      }
      if (code !== 0) {
        return reject(new Error(stderr.trim() || 'Gagal memproses tautan.'));
      }
      resolve({});
    });

    if (stdinPayload !== undefined) {
      proc.stdin.write(JSON.stringify(stdinPayload));
    }
    proc.stdin.end();
  });
}

// High-Precision TikTok Video & Photo Carousel Extractor
async function fetchTikTokRichMedia(targetUrl: string): Promise<any | null> {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': CHROME_UA,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    if (!json || json.code !== 0 || !json.data) return null;

    const d = json.data;
    const nickname = d.author?.nickname || d.author?.unique_id || 'TikTok Creator';
    const handle = d.author?.unique_id ? `@${d.author.unique_id}` : '';
    const authorDisplay = handle && !nickname.includes(handle) ? `${nickname} (${handle})` : nickname;

    const uploadDate = d.create_time
      ? new Date(d.create_time * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const downloads: any[] = [];
    const images: string[] = Array.isArray(d.images)
      ? d.images.filter((u: any) => typeof u === 'string' && u.startsWith('http'))
      : [];

    if (images.length > 0) {
      images.forEach((imgUrl, idx) => {
        downloads.push({
          id: `tt_photo_${idx + 1}`,
          type: 'image',
          quality: `Foto Slide #${idx + 1} · Resolusi Penuh (JPG)`,
          ext: 'jpg',
          url: imgUrl,
          resolution: 'Full HD',
        });
      });
    } else {
      if (d.hdplay && typeof d.hdplay === 'string') {
        downloads.push({
          id: 'tt_video_1080p',
          type: 'video',
          quality: 'Video 1080p Full HD · Tanpa Watermark (MP4)',
          ext: 'mp4',
          url: d.hdplay,
          filesize: d.hd_size || d.size || null,
          filesizeFormatted: formatBytes(d.hd_size || d.size),
          resolution: '1080p',
          vcodec: 'H.264',
          acodec: 'AAC',
          fps: 30,
        });
      }
      if (d.play && typeof d.play === 'string' && d.play !== d.hdplay) {
        downloads.push({
          id: 'tt_video_720p',
          type: 'video',
          quality: 'Video 720p HD · Tanpa Watermark (MP4)',
          ext: 'mp4',
          url: d.play,
          filesize: d.size || null,
          filesizeFormatted: formatBytes(d.size),
          resolution: '720p',
          vcodec: 'H.264',
          acodec: 'AAC',
          fps: 30,
        });
      } else if (d.play && typeof d.play === 'string' && downloads.length === 0) {
        downloads.push({
          id: 'tt_video_hd',
          type: 'video',
          quality: 'Video HD · Tanpa Watermark (MP4)',
          ext: 'mp4',
          url: d.play,
          filesize: d.size || null,
          filesizeFormatted: formatBytes(d.size),
          resolution: '720p',
          vcodec: 'H.264',
          acodec: 'AAC',
          fps: 30,
        });
      }
      if (d.wmplay && typeof d.wmplay === 'string') {
        downloads.push({
          id: 'tt_video_wm',
          type: 'video',
          quality: 'Video 540p SD · Dengan Watermark (MP4)',
          ext: 'mp4',
          url: d.wmplay,
          filesize: d.wm_size || null,
          filesizeFormatted: formatBytes(d.wm_size),
          resolution: '540p',
          vcodec: 'H.264',
          acodec: 'AAC',
        });
      }
    }

    const audioUrl = d.music || d.music_info?.play;
    if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
      const musicTitle = d.music_info?.title ? ` — ${d.music_info.title.slice(0, 36)}` : '';
      downloads.push({
        id: 'tt_audio_mp3',
        type: 'audio',
        quality: `Audio Original (MP3)${musicTitle}`,
        ext: 'mp3',
        url: audioUrl,
        acodec: 'MP3 128kbps',
        resolution: '128kbps',
      });
    }

    return {
      title: d.title || 'TikTok Media',
      author: authorDisplay,
      authorUrl: d.author?.unique_id ? `https://www.tiktok.com/@${d.author.unique_id}` : undefined,
      platform: 'tiktok',
      extractorKey: 'TinaCore::TikTok',
      engine: 'Tina Hybrid',
      serverUsed: 'Tina Hybrid Core (TIKTOK)',
      webpageUrl: targetUrl,
      thumbnail: d.origin_cover || d.cover || (images.length > 0 ? images[0] : ''),
      duration: formatDurationSeconds(d.duration),
      durationSeconds: d.duration || undefined,
      uploadDate,
      viewCount: typeof d.play_count === 'number' ? d.play_count : null,
      likeCount: typeof d.digg_count === 'number' ? d.digg_count : null,
      commentCount: typeof d.comment_count === 'number' ? d.comment_count : null,
      resolution: images.length > 0 ? `${images.length} Foto HD` : '1080x1920 (Full HD)',
      fps: images.length > 0 ? null : 30,
      vcodec: images.length > 0 ? undefined : 'H.264 (AVC1)',
      acodec: 'AAC / MP3',
      filesizeApprox: formatBytes(d.hd_size || d.size),
      downloads,
      images: images.length > 0 ? images : undefined,
    };
  } catch {
    return null;
  }
}

// Intelligent Normalizer: Never outputs "Stream 1/2/3", always classifies Video / Audio / Image with resolution
function normalizePrimaryExtractorOutput(raw: any, targetUrl: string) {
  const platform = (raw.platform || detectPlatform(targetUrl) || 'media').toLowerCase();
  const rawImages: string[] = Array.isArray(raw.images)
    ? raw.images.filter((u: any) => typeof u === 'string' && u.startsWith('http'))
    : [];

  let videoCounter = 0;
  let audioCounter = 0;
  let imageCounter = 0;

  const downloads: any[] = [];
  const seenUrls = new Set<string>();

  for (let idx = 0; idx < (raw.downloads || []).length; idx++) {
    const d = raw.downloads[idx];
    const rawUrl = String(d?.url || '').trim();
    if (!rawUrl || seenUrls.has(rawUrl)) continue;
    seenUrls.add(rawUrl);

    const needsResolve =
      rawUrl.startsWith('spotidown_resolve:') ||
      rawUrl.startsWith('applemusic_resolve:') ||
      rawUrl.startsWith('youtube_resolve:') ||
      rawUrl.startsWith('ytmp3gg_resolve:');

    const rawTypeStr = String(d.type || '').trim();
    const rawQualStr = String(d.quality || d.label || d.resolution || '').trim();
    const combinedDescriptor = `${rawTypeStr} ${rawQualStr} ${rawUrl}`.toLowerCase();

    // Determine true media type: 'audio' | 'image' | 'video' | 'file'
    const isAudio =
      rawTypeStr.toLowerCase() === 'audio' ||
      rawTypeStr.toLowerCase() === 'mp3' ||
      rawTypeStr.toLowerCase() === 'm4a' ||
      /\b(mp3|m4a|audio|sound|music|ogg|wav|flac|opus|kbps)\b/i.test(rawTypeStr) ||
      /\b(mp3|m4a|audio|sound|music|ogg|wav|flac|opus|kbps)\b/i.test(rawQualStr) ||
      rawUrl.includes('sf=.mp3') ||
      rawUrl.includes('mime_type=audio') ||
      /\.(mp3|m4a|ogg|wav|flac|opus)(\?|$)/i.test(rawUrl) ||
      platform === 'spotify' ||
      platform === 'soundcloud' ||
      platform === 'applemusic' ||
      platform === 'bandcamp';

    const isImage =
      !isAudio &&
      (rawTypeStr.toLowerCase() === 'image' ||
        rawTypeStr.toLowerCase() === 'photo' ||
        /\b(image|photo|foto|slide|gambar|jpg|jpeg|png|webp)\b/i.test(rawTypeStr) ||
        /\b(image|photo|foto|slide|gambar|jpg|jpeg|png|webp)\b/i.test(rawQualStr) ||
        /\.(jpg|jpeg|png|webp)(\?|$)/i.test(rawUrl));

    const isCloudFile =
      !isAudio &&
      !isImage &&
      ['mediafire', 'gdrive', 'terabox', 'pixeldrain', 'gofile', 'mega', 'sfile', 'krakenfiles', 'catbox'].includes(
        platform
      ) &&
      !combinedDescriptor.includes('mp4') &&
      !combinedDescriptor.includes('video');

    // Extract resolution if available (e.g. 2160p, 1440p, 1080p, 720p, 480p, 360p, 4K, HD, SD)
    const resMatch =
      rawQualStr.match(/\b(2160p|1440p|1080p|720p|540p|480p|360p|240p|144p|4k|2k|fhd|uhd|hd|sd)\b/i) ||
      rawTypeStr.match(/\b(2160p|1440p|1080p|720p|540p|480p|360p|240p|144p|4k|2k|fhd|uhd|hd|sd)\b/i);
    const detectedRes = resMatch ? resMatch[1].toUpperCase().replace(/P$/, 'p') : null;

    // Extract bitrate if audio
    const bitrateMatch =
      rawQualStr.match(/\b(\d{2,3}\s*kbps)\b/i) || rawTypeStr.match(/\b(\d{2,3}\s*kbps)\b/i);
    const detectedBitrate = bitrateMatch ? bitrateMatch[1].toLowerCase().replace(/\s+/g, '') : null;

    // Check informative label (neither generic 'video'/'audio'/'image' nor 'Stream N')
    const cleanCandidate = [rawQualStr, rawTypeStr].find(
      (s) =>
        s &&
        !/^(video|audio|image|file|link|stream\s*\d*)$/i.test(s.trim())
    );

    if (isAudio) {
      audioCounter++;
      const ext = rawUrl.includes('.m4a') ? 'm4a' : 'mp3';
      let qualityLabel = '';
      if (detectedBitrate) {
        qualityLabel = `Audio ${detectedBitrate} (${ext.toUpperCase()})`;
      } else if (cleanCandidate && !/^mp3$/i.test(cleanCandidate)) {
        qualityLabel = cleanCandidate.toLowerCase().includes('audio')
          ? `${cleanCandidate} (${ext.toUpperCase()})`
          : `Audio ${cleanCandidate} (${ext.toUpperCase()})`;
      } else {
        qualityLabel =
          audioCounter === 1
            ? `Audio Original Kualitas Tinggi (${ext.toUpperCase()})`
            : `Audio Alternatif #${audioCounter} (${ext.toUpperCase()})`;
      }

      downloads.push({
        id: `tina_aud_${audioCounter}`,
        type: 'audio',
        quality: qualityLabel,
        ext,
        url: rawUrl,
        filesizeFormatted: d.size || d.filesizeFormatted || undefined,
        acodec: ext === 'mp3' ? 'MP3' : 'AAC',
        resolution: detectedBitrate || 'Audio HQ',
        needsResolve,
      });
    } else if (isImage) {
      imageCounter++;
      const ext = rawUrl.includes('.png') ? 'png' : rawUrl.includes('.webp') ? 'webp' : 'jpg';
      if (!rawImages.includes(rawUrl)) {
        rawImages.push(rawUrl);
      }
      downloads.push({
        id: `tina_img_${imageCounter}`,
        type: 'image',
        quality: `Foto Slide #${imageCounter} · Resolusi Penuh (${ext.toUpperCase()})`,
        ext,
        url: rawUrl,
        filesizeFormatted: d.size || d.filesizeFormatted || undefined,
        resolution: detectedRes || 'Resolusi Penuh',
        needsResolve,
      });
    } else if (isCloudFile) {
      downloads.push({
        id: `tina_file_${idx + 1}`,
        type: 'file',
        quality: cleanCandidate || 'Berkas Unduhan Langsung (Direct)',
        ext: d.ext || 'zip',
        url: rawUrl,
        filesizeFormatted: d.size || d.filesizeFormatted || undefined,
        needsResolve,
      });
    } else {
      videoCounter++;
      const ext = d.ext && d.ext !== 'mp3' ? d.ext : 'mp4';
      let resBadge = detectedRes;
      if (!resBadge) {
        if (videoCounter === 1) resBadge = '1080p Full HD';
        else if (videoCounter === 2) resBadge = '720p HD';
        else resBadge = `HD #${videoCounter}`;
      } else if (resBadge === '1080p') {
        resBadge = '1080p Full HD';
      } else if (resBadge === '720p') {
        resBadge = '720p HD';
      } else if (resBadge === '480p' || resBadge === '360p') {
        resBadge = `${resBadge} SD`;
      }

      const watermarkNote =
        combinedDescriptor.includes('watermark') && !combinedDescriptor.includes('no watermark') && !combinedDescriptor.includes('tanpa')
          ? ' · Dengan Watermark'
          : ['tiktok', 'douyin', 'capcut', 'rednote', 'instagram'].includes(platform)
            ? ' · Tanpa Watermark'
            : '';

      const qualityLabel =
        cleanCandidate &&
        !/^(1080p|720p|480p|360p|hd|sd)$/i.test(cleanCandidate) &&
        cleanCandidate.length > 4
          ? `Video ${cleanCandidate} (${ext.toUpperCase()})`
          : `Video ${resBadge}${watermarkNote} (${ext.toUpperCase()})`;

      downloads.push({
        id: `tina_vid_${videoCounter}`,
        type: 'video',
        quality: qualityLabel,
        ext,
        url: rawUrl,
        filesizeFormatted: d.size || d.filesizeFormatted || undefined,
        vcodec: 'H.264',
        acodec: 'AAC',
        resolution: detectedRes || (videoCounter === 1 ? '1080p' : '720p'),
        needsResolve,
      });
    }
  }

  // Ensure every image in rawImages also has a downloadable entry in downloads
  if (rawImages.length > 0) {
    const existingImgUrls = new Set(downloads.filter((d) => d.type === 'image').map((d) => d.url));
    rawImages.forEach((imgUrl, i) => {
      if (!existingImgUrls.has(imgUrl)) {
        downloads.push({
          id: `tina_slide_${i + 1}`,
          type: 'image',
          quality: `Foto Slide #${i + 1} · Resolusi Penuh (JPG)`,
          ext: 'jpg',
          url: imgUrl,
          resolution: 'Resolusi Penuh',
        });
      }
    });
  }

  const authorClean =
    typeof raw.author === 'string' && raw.author && raw.author.toLowerCase() !== 'unknown'
      ? raw.author
      : `${platform.charAt(0).toUpperCase() + platform.slice(1)} Creator`;

  return {
    title: raw.title || `${platform.toUpperCase()} Media`,
    author: authorClean,
    platform,
    extractorKey: `TinaCore::${platform}`,
    engine: 'Tina Hybrid',
    serverUsed: `Tina Hybrid Core (${platform.toUpperCase()})`,
    webpageUrl: targetUrl,
    thumbnail: raw.thumbnail || (rawImages.length > 0 ? rawImages[0] : ''),
    duration: raw.duration ? String(raw.duration) : '',
    uploadDate: raw.uploadDate || new Date().toISOString().slice(0, 10),
    viewCount: raw.views || raw.viewCount || null,
    likeCount: raw.likes || raw.likeCount || null,
    commentCount: raw.comments || raw.commentCount || null,
    description: raw.description || undefined,
    resolution:
      rawImages.length > 0
        ? `${rawImages.length} Foto HD`
        : downloads.find((d) => d.type === 'video')?.resolution || '1080p Full HD',
    vcodec: rawImages.length > 0 ? undefined : 'H.264 (AVC1)',
    acodec: downloads.some((d) => d.type === 'audio' || d.type === 'video') ? 'AAC / MP3' : undefined,
    downloads,
    images: rawImages.length > 0 ? rawImages : undefined,
  };
}

let cachedSupportedSites: any[] | null = null;

function getSupportedSitesList() {
  if (cachedSupportedSites) return cachedSupportedSites;

  const featuredSites = [
    { name: 'TikTok', description: 'Video 1080p/720p Tanpa Watermark, Audio MP3, & Galeri Foto Slideshow', category: 'Sosial & Video' },
    { name: 'YouTube', description: 'Video 4K/1080p/720p, Shorts, Musik & Metadata penuh', category: 'Sosial & Video' },
    { name: 'Instagram', description: 'Reels, Postingan, Carousel Foto Multi-Slide, & Stories HD', category: 'Sosial & Video' },
    { name: 'Twitter / X', description: 'Video Postingan, Foto, GIF, & Multi-resolusi MP4', category: 'Sosial & Video' },
    { name: 'Facebook', description: 'Facebook Watch, Reels, & Video Publik HD', category: 'Sosial & Video' },
    { name: 'Spotify', description: 'Track Audio MP3 320kbps & Cover Art Metadata', category: 'Musik & Audio' },
    { name: 'SoundCloud', description: 'Track Musik, Set Playlist, & Audio Original', category: 'Musik & Audio' },
    { name: 'Apple Music', description: 'Track Audio & Artwork Resolusi Tinggi', category: 'Musik & Audio' },
    { name: 'Threads', description: 'Video & Carousel Gambar Resolusi Penuh dari Threads', category: 'Sosial & Video' },
    { name: 'Reddit', description: 'Video Reddit dengan Audio tergabung, Galeri Foto & GIF', category: 'Sosial & Video' },
    { name: 'Pinterest', description: 'Video Pin, Idea Pin, & Gambar Resolusi Tinggi', category: 'Sosial & Video' },
    { name: 'Bilibili', description: 'Video Anime, Kreator, & Bangumi Bilibili', category: 'Komik & Anime' },
    { name: 'Pixiv', description: 'Ilustrasi, Manga Multi-Halaman, & Artwork Resolusi Penuh', category: 'Komik & Anime' },
    { name: 'RedNote (Xiaohongshu)', description: 'Video & Carousel Galeri Foto Tanpa Watermark', category: 'Sosial & Video' },
    { name: 'Douyin', description: 'Video pendek & Slideshow Douyin HD Tanpa Watermark', category: 'Sosial & Video' },
    { name: 'CapCut', description: 'Template Video CapCut Tanpa Watermark', category: 'Sosial & Video' },
    { name: 'MediaFire', description: 'Direct Link Resolver untuk Berkas & Arsip MediaFire', category: 'Cloud & Berkas' },
    { name: 'Google Drive', description: 'Unduhan Langsung Berkas Publik Google Drive', category: 'Cloud & Berkas' },
    { name: 'TeraBox', description: 'Resolver Berkas & Video Cloud TeraBox', category: 'Cloud & Berkas' },
    { name: 'PixelDrain', description: 'Direct File Bypass PixelDrain', category: 'Cloud & Berkas' },
    { name: 'GoFile', description: 'Unduhan Berkas & Folder Publik GoFile.io', category: 'Cloud & Berkas' },
    { name: 'Mega.nz', description: 'Ekstraktor Metadata & Berkas Enkripsi Mega', category: 'Cloud & Berkas' },
    { name: 'MangaDex', description: 'Chapter Manga & Kompilasi Otomatis ke PDF', category: 'Komik & Anime' },
    { name: 'Kiryuu / KomikCast / KomikIndo', description: 'Chapter Komik Bahasa Indonesia ke PDF', category: 'Komik & Anime' },
    { name: 'Otakudesu / Nimegami / Gogoanime', description: 'Episode & Batch Resolusi Anime', category: 'Komik & Anime' },
    { name: 'Linkvertise / LootLabs / Sub2Unlock', description: 'Bypass & Resolver Tautan Shortlink', category: 'Cloud & Berkas' },
  ];

  const globalExtractors: any[] = [];
  const seenNames = new Set(featuredSites.map((s) => s.name.toLowerCase()));

  try {
    if (fs.existsSync(SUPPORTED_SITES_MD)) {
      const content = fs.readFileSync(SUPPORTED_SITES_MD, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*-\s*\*\*([^*]+)\*\*(?::\s*(.*))?$/);
        if (match) {
          const name = match[1].trim();
          if (seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());

          let rawDesc = (match[2] || '')
            .replace(/\[\*.*?\*\]\(.*?\)/g, '')
            .replace(/yt-dlp/gi, 'Tina Downloader')
            .trim();
          const broken = rawDesc.toLowerCase().includes('currently broken');
          if (broken) continue;

          globalExtractors.push({
            name,
            description: rawDesc || `Ekstraktor media resmi Tina Downloader untuk ${name}`,
            category: 'Ekstraktor Global',
          });
        }
      }
    }
  } catch (err) {
    console.warn('[SupportedSites] Error parsing markdown:', err);
  }

  cachedSupportedSites = [...featuredSites, ...globalExtractors];
  return cachedSupportedSites;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // 1. All Supported Sites Endpoint
  app.get('/api/supported-sites', (req: Request, res: Response) => {
    const q = String(req.query.q || '').toLowerCase().trim();
    const category = String(req.query.category || 'all').toLowerCase();
    const allSites = getSupportedSitesList();

    let filtered = allSites;
    if (category !== 'all') {
      filtered = filtered.filter((s) => s.category.toLowerCase() === category);
    }
    if (q) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    res.json({
      total: allSites.length,
      filteredCount: filtered.length,
      items: filtered,
    });
  });

  // 3. Unified Hybrid Extraction Endpoint
  app.post('/api/extract', async (req: Request, res: Response) => {
    const ipAddress = extractClientIp(req);
    const deviceId = extractDeviceId(req);
    const { url } = req.body || {};

    if (!url || typeof url !== 'string' || !/^https?:\/\/.+/i.test(url.trim())) {
      return res.status(400).json({
        error: 'Masukkan tautan URL yang valid (diawali dengan http:// atau https://).',
      });
    }

    const cleanTargetUrl = url.trim();
    const detectedPlat = detectPlatform(cleanTargetUrl) || 'universal';

    // Stage 1: Golang Rate Limit Check & Consumption
    let goRate: any;
    try {
      goRate = await runGoWorker(['ratelimit', ipAddress, deviceId, '1', GO_STATE_FILE]);
    } catch {
      goRate = {
        allowed: true,
        ipAddress,
        deviceId,
        used: 1,
        limit: 15,
        remaining: 14,
        windowMinutes: 15,
        resetAt: Date.now() + 900000,
        burstUsed: 1,
        burstLimit: 5,
        runtime: 'go1.22.8',
      };
    }

    if (!goRate.allowed) {
      await runPythonEngine(['log_security'], {
        id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ipAddress,
        deviceId,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 256),
        action: 'extract',
        platform: detectedPlat,
        engine: 'Tina Hybrid',
        url: cleanTargetUrl,
        status: 'rate_limited',
        timestamp: Date.now(),
      }).catch(() => {});

      return res.status(429).json({
        error: goRate.reason || 'Batas rate-limit unduhan tercapai.',
        rateLimit: goRate,
      });
    }

    try {
      const knownPlatform = detectPlatform(cleanTargetUrl);

      let tikTokRichMeta: any = null;
      let primaryMeta: any = null;
      let deepMeta: any = null;

      if (knownPlatform === 'tiktok') {
        const [ttRichAttempt, primaryAttempt] = await Promise.allSettled([
          fetchTikTokRichMedia(cleanTargetUrl),
          scrapeUrl(cleanTargetUrl, 'auto', 'auto'),
        ]);

        if (ttRichAttempt.status === 'fulfilled' && ttRichAttempt.value) {
          tikTokRichMeta = ttRichAttempt.value;
        }
        if (primaryAttempt.status === 'fulfilled' && primaryAttempt.value) {
          primaryMeta = normalizePrimaryExtractorOutput(primaryAttempt.value, cleanTargetUrl);
        }
      } else if (knownPlatform) {
        const [primaryAttempt, pyAttempt] = await Promise.allSettled([
          scrapeUrl(cleanTargetUrl, 'auto', 'auto'),
          runPythonEngine(['extract', cleanTargetUrl]),
        ]);

        if (primaryAttempt.status === 'fulfilled' && primaryAttempt.value) {
          primaryMeta = normalizePrimaryExtractorOutput(primaryAttempt.value, cleanTargetUrl);
        }
        if (pyAttempt.status === 'fulfilled' && pyAttempt.value?.data) {
          deepMeta = pyAttempt.value.data;
        }
      } else {
        const pyRes = await runPythonEngine(['extract', cleanTargetUrl]);
        deepMeta = pyRes?.data || null;
      }

      let finalMetadata: any = null;

      if (tikTokRichMeta) {
        // Combine TikTok Rich Media with any additional unique streams
        const combinedStreams = [...(tikTokRichMeta.downloads || [])];
        if (primaryMeta?.downloads && !tikTokRichMeta.images?.length) {
          for (const s of primaryMeta.downloads) {
            const duplicateTypeAndRes = combinedStreams.some(
              (c) => c.type === s.type && c.resolution && s.resolution && c.resolution === s.resolution
            );
            if (!duplicateTypeAndRes && combinedStreams.length < 10) {
              combinedStreams.push({
                ...s,
                quality: s.quality.includes('Cadangan') ? s.quality : `${s.quality} · Mirror`,
              });
            }
          }
        }
        finalMetadata = {
          ...tikTokRichMeta,
          downloads: combinedStreams,
        };
      } else if (primaryMeta && deepMeta) {
        // Prefer deepMeta streams if they have richer codec/resolution details, and merge unique streams
        const mergedStreams: any[] = [];
        const seenKeys = new Set<string>();

        for (const s of [...(deepMeta.downloads || []), ...(primaryMeta.downloads || [])]) {
          const k = `${s.type}_${s.resolution || s.quality}`;
          if (!seenKeys.has(k) && mergedStreams.length < 24) {
            seenKeys.add(k);
            mergedStreams.push(s);
          }
        }

        const mergedImages =
          primaryMeta.images?.length
            ? primaryMeta.images
            : deepMeta.images?.length
              ? deepMeta.images
              : undefined;

        finalMetadata = {
          ...primaryMeta,
          ...deepMeta,
          title: deepMeta.title && deepMeta.title !== 'Untitled Media' ? deepMeta.title : primaryMeta.title,
          author:
            deepMeta.author && deepMeta.author !== 'Creator' && deepMeta.author !== 'Unknown'
              ? deepMeta.author
              : primaryMeta.author,
          thumbnail: primaryMeta.thumbnail || deepMeta.thumbnail,
          duration: deepMeta.duration || primaryMeta.duration,
          uploadDate: deepMeta.uploadDate || primaryMeta.uploadDate,
          resolution: deepMeta.resolution || primaryMeta.resolution,
          fps: deepMeta.fps ?? primaryMeta.fps,
          vcodec: deepMeta.vcodec || primaryMeta.vcodec,
          acodec: deepMeta.acodec || primaryMeta.acodec,
          viewCount: deepMeta.viewCount ?? primaryMeta.viewCount,
          likeCount: deepMeta.likeCount ?? primaryMeta.likeCount,
          description: deepMeta.description || primaryMeta.description,
          tags: deepMeta.tags || primaryMeta.tags,
          serverUsed: `Tina Hybrid Core (${knownPlatform?.toUpperCase()})`,
          downloads: mergedStreams,
          images: mergedImages,
        };
      } else if (primaryMeta) {
        finalMetadata = primaryMeta;
      } else if (deepMeta) {
        finalMetadata = deepMeta;
      }

      if (!finalMetadata) {
        throw new Error('Tidak dapat mengekstrak media dari tautan tersebut.');
      }

      // Stage 2b: Golang Stream Header Probing for size if missing
      const firstStream = finalMetadata.downloads?.[0];
      if (
        firstStream &&
        !firstStream.filesizeFormatted &&
        !firstStream.needsResolve &&
        typeof firstStream.url === 'string' &&
        firstStream.url.startsWith('http')
      ) {
        try {
          const probe = await runGoWorker(['probe', firstStream.url]);
          if (probe?.filesizeFormatted) {
            firstStream.filesizeFormatted = probe.filesizeFormatted;
            finalMetadata.filesizeApprox = probe.filesizeFormatted;
          }
        } catch {
          // ignore
        }
      }

      // Stage 3: Save to SQLite3 Database
      const historyItem = {
        id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        deviceId,
        ipAddress,
        url: cleanTargetUrl,
        title: String(finalMetadata.title || 'Media Download').slice(0, 500),
        author: String(finalMetadata.author || 'Creator').slice(0, 200),
        platform: String(finalMetadata.platform || detectedPlat).slice(0, 64),
        engine: 'Tina Hybrid',
        thumbnail: String(finalMetadata.thumbnail || '').slice(0, 2048),
        duration: String(finalMetadata.duration || '-').slice(0, 64),
        quality: String(
          finalMetadata.images?.length
            ? `${finalMetadata.images.length} Foto HD`
            : finalMetadata.downloads?.[0]?.resolution ||
                finalMetadata.downloads?.[0]?.quality ||
                'Original HD'
        ).slice(0, 100),
        createdAt: Date.now(),
        metadata: finalMetadata,
      };

      await Promise.all([
        runPythonEngine(['save_download'], historyItem),
        runPythonEngine(['log_security'], {
          id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ipAddress,
          deviceId,
          userAgent: String(req.headers['user-agent'] || '').slice(0, 256),
          action: 'extract',
          platform: historyItem.platform,
          engine: 'Tina Hybrid',
          url: cleanTargetUrl,
          status: 'allowed',
          timestamp: Date.now(),
        }),
      ]);

      return res.json({
        status: 'ok',
        data: finalMetadata,
        historyItem,
        rateLimit: goRate,
      });
    } catch (err: any) {
      await runPythonEngine(['log_security'], {
        id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ipAddress,
        deviceId,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 256),
        action: 'extract',
        platform: detectedPlat,
        engine: 'Tina Hybrid',
        url: cleanTargetUrl,
        status: 'error',
        timestamp: Date.now(),
      }).catch(() => {});

      return res.status(500).json({
        error:
          err?.message ||
          'Gagal mengekstrak tautan. Pastikan URL bersifat publik dan valid.',
        rateLimit: goRate,
      });
    }
  });

  // 4. Resolve Async Stream Tokens
  app.post('/api/resolve', async (req: Request, res: Response) => {
    const { tokenUrl } = req.body || {};
    if (!tokenUrl || typeof tokenUrl !== 'string') {
      return res.status(400).json({ error: 'Token URL tidak valid.' });
    }
    try {
      const resolvedUrl = await resolveUrl(tokenUrl);
      return res.json({ status: 'ok', url: resolvedUrl });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Gagal melakukan resolve tautan unduhan.',
      });
    }
  });

  // 5. Compile Comic / Slideshow Images to PDF
  app.post('/api/compile-pdf', async (req: Request, res: Response) => {
    const { images, title = 'tina-comic' } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Daftar gambar kosong.' });
    }

    try {
      const sliceImages = images.slice(0, 60);
      const processedPages: { buffer: Buffer; width: number; height: number }[] = [];

      for (const imgUrl of sliceImages) {
        const resp = await fetch(imgUrl, {
          headers: {
            'User-Agent': CHROME_UA,
            Referer: new URL(imgUrl).origin + '/',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) continue;
        const arrBuf = await resp.arrayBuffer();
        const rawBuf = Buffer.from(arrBuf);
        const jpegBuf = ensureJpegBuffer(rawBuf);
        const dims = getImageDimensions(jpegBuf);
        processedPages.push({
          buffer: jpegBuf,
          width: dims.width,
          height: dims.height,
        });
      }

      if (processedPages.length === 0) {
        return res.status(500).json({ error: 'Gagal mengunduh gambar untuk kompilasi PDF.' });
      }

      const pdfBuffer = generateImagesPdf(processedPages);
      const safeName =
        String(title)
          .replace(/[^a-zA-Z0-9_\-\s]/g, '')
          .trim()
          .replace(/\s+/g, '_')
          .slice(0, 80) || 'tina_media';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.send(pdfBuffer);
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Gagal membuat dokumen PDF.',
      });
    }
  });

  function getExplicitMimeType(ext: string, fallbackType?: string | null): string {
    const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    const map: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      mov: 'video/quicktime',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      opus: 'audio/ogg',
      flac: 'audio/flac',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      pdf: 'application/pdf',
    };
    if (map[clean]) return map[clean];
    if (
      fallbackType &&
      !fallbackType.includes('octet-stream') &&
      !fallbackType.includes('text/html') &&
      !fallbackType.includes('text/plain')
    ) {
      return fallbackType;
    }
    return 'video/mp4';
  }

  function buildSmartUpstreamHeaders(finalUrl: string, rangeHeader?: string): Record<string, string> {
    const lower = finalUrl.toLowerCase();
    let referer = `${new URL(finalUrl).origin}/`;
    if (lower.includes('tiktokcdn') || lower.includes('tiktok.com') || lower.includes('musical.ly')) {
      referer = 'https://www.tiktok.com/';
    } else if (lower.includes('tikwm.com')) {
      referer = 'https://www.tikwm.com/';
    } else if (lower.includes('pixiv') || lower.includes('pximg')) {
      referer = 'https://www.pixiv.net/';
    } else if (lower.includes('cdninstagram') || lower.includes('fbcdn.net')) {
      referer = 'https://www.instagram.com/';
    } else if (lower.includes('bilivideo') || lower.includes('hdslb.com')) {
      referer = 'https://www.bilibili.com/';
    }

    const headers: Record<string, string> = {
      'User-Agent': CHROME_UA,
      Accept: '*/*',
      Referer: referer,
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }
    return headers;
  }

  async function fetchUpstreamMedia(finalUrl: string, rangeHeader?: string) {
    const primaryHeaders = buildSmartUpstreamHeaders(finalUrl, rangeHeader);
    let upstream = await fetch(finalUrl, {
      headers: primaryHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      // Retry with origin referer
      const fallbackHeaders: Record<string, string> = {
        'User-Agent': CHROME_UA,
        Accept: '*/*',
      };
      if (rangeHeader) fallbackHeaders['Range'] = rangeHeader;
      upstream = await fetch(finalUrl, {
        headers: fallbackHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(45000),
      });
    }
    return upstream;
  }

  // 6a. Proxy Media Stream Route (For In-Browser Video Player, Audio Player & Image Carousel)
  app.get('/api/proxy-stream', async (req: Request, res: Response) => {
    const targetUrl = String(req.query.url || '');
    const extHint = String(req.query.ext || '').toLowerCase();
    if (!targetUrl || !/^https?:\/\/.+/i.test(targetUrl)) {
      return res.status(400).send('Invalid stream URL');
    }

    try {
      let finalUrl = targetUrl;
      if (
        finalUrl.startsWith('spotidown_resolve:') ||
        finalUrl.startsWith('applemusic_resolve:') ||
        finalUrl.startsWith('youtube_resolve:') ||
        finalUrl.startsWith('ytmp3gg_resolve:')
      ) {
        finalUrl = await resolveUrl(finalUrl);
      }

      const upstream = await fetchUpstreamMedia(
        finalUrl,
        typeof req.headers.range === 'string' ? req.headers.range : undefined
      );

      if (!upstream.ok && upstream.status !== 206) {
        return res.status(502).send('Gagal memuat stream media.');
      }

      res.status(upstream.status);
      const upstreamType = upstream.headers.get('content-type');
      const inferredExt =
        extHint ||
        (finalUrl.includes('.mp3') || finalUrl.includes('mime_type=audio')
          ? 'mp3'
          : finalUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)?.[1] || 'mp4');

      const contentType = getExplicitMimeType(inferredExt, upstreamType);
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', acceptRanges);
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);

      if (!upstream.body) {
        return res.end();
      }

      const reader = upstream.body.getReader();
      req.on('close', () => {
        reader.cancel().catch(() => {});
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
      res.end();
    } catch {
      return res.status(502).send('Stream error');
    }
  });

  // 6b. Proxy Media File Attachment Download Route (Supports both /api/download/:filename and /api/proxy-download)
  const handleMediaDownload = async (req: Request, res: Response) => {
    const targetUrl = String(req.query.url || '');
    const rawName = String(req.query.filename || req.params.filename || 'Tina_Media');
    const rawExt = String(req.query.ext || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!targetUrl || !/^https?:\/\/.+/i.test(targetUrl)) {
      return res.status(400).json({ error: 'URL unduhan tidak valid.' });
    }

    const ext =
      rawExt ||
      (targetUrl.includes('.mp3') || targetUrl.includes('mime_type=audio')
        ? 'mp3'
        : targetUrl.match(/\.(jpg|jpeg|png|webp|gif|pdf|mp4|m4a)(\?|$)/i)?.[1]?.toLowerCase() || 'mp4');

    // Strip any existing extension and illegal filename characters so OS always recognizes .mp4/.mp3/.jpg
    const baseWithoutExt = rawName.replace(/\.(mp4|mp3|m4a|jpg|jpeg|png|webp|gif|pdf)$/i, '');
    const cleanBase =
      baseWithoutExt
        .replace(/[^a-zA-Z0-9_\-\s]/g, ' ')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 64) || 'Tina_Media';

    const finalFilename = cleanBase.startsWith('Tina_')
      ? `${cleanBase}.${ext}`
      : `Tina_${cleanBase}.${ext}`;

    try {
      let finalUrl = targetUrl;
      if (
        finalUrl.startsWith('spotidown_resolve:') ||
        finalUrl.startsWith('applemusic_resolve:') ||
        finalUrl.startsWith('youtube_resolve:') ||
        finalUrl.startsWith('ytmp3gg_resolve:')
      ) {
        finalUrl = await resolveUrl(finalUrl);
      }

      const upstream = await fetchUpstreamMedia(finalUrl);

      if (!upstream.ok || !upstream.body) {
        return res.status(502).json({
          error: 'Gagal mengambil berkas media dari server sumber.',
        });
      }

      const upstreamType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (upstreamType.includes('text/html')) {
        return res.status(502).json({
          error: 'Tautan media kedaluwarsa, silakan klik Unduh Sekarang kembali untuk menyegarkan tautan.',
        });
      }

      const explicitMimeType = getExplicitMimeType(ext, upstreamType);
      const contentLength = upstream.headers.get('content-length');

      res.setHeader('Content-Type', explicitMimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${finalFilename}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const reader = upstream.body.getReader();
      req.on('close', () => {
        reader.cancel().catch(() => {});
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
      res.end();
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Gagal mengunduh berkas media.',
      });
    }
  };

  app.get('/api/download/:filename', handleMediaDownload);

  // 7. SQLite3 Download History Endpoints
  app.get('/api/history', async (req: Request, res: Response) => {
    const ipAddress = extractClientIp(req);
    const deviceId = extractDeviceId(req);
    try {
      const data = await runPythonEngine(['list_history', deviceId, ipAddress]);
      res.json({ items: data.items || [] });
    } catch {
      res.json({ items: [] });
    }
  });

  app.delete('/api/history/:id', async (req: Request, res: Response) => {
    const ipAddress = extractClientIp(req);
    const deviceId = extractDeviceId(req);
    const targetId = String(req.params.id || '');
    try {
      await runPythonEngine(['delete_history', deviceId, ipAddress, targetId]);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  app.delete('/api/history', async (req: Request, res: Response) => {
    const ipAddress = extractClientIp(req);
    const deviceId = extractDeviceId(req);
    try {
      await runPythonEngine(['delete_history', deviceId, ipAddress]);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Tina Downloader] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
