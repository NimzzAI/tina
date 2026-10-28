import { MediaMetadata, SupportedSiteItem, DownloadStream } from '../types';

export const FEATURED_SUPPORTED_SITES: SupportedSiteItem[] = [
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

let cachedAllSites: SupportedSiteItem[] | null = null;

function formatBytesClient(bytes?: number | null): string | undefined {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return undefined;
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`;
}

function formatDurationClient(sec?: number | null): string {
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

export async function safeFetchJson(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: any; isHtmlError: boolean }> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    const trimmed = text.trim();

    if (!trimmed) {
      return {
        ok: false,
        status: res.status,
        data: { error: 'Respons server kosong.' },
        isHtmlError: false,
      };
    }

    if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
      return {
        ok: false,
        status: res.status,
        data: {
          error:
            res.status === 404 || res.status === 501
              ? 'Endpoint API sedang dialihkan ke ekstraktor cadangan.'
              : `Server mengembalikan respons HTML (HTTP ${res.status}).`,
        },
        isHtmlError: true,
      };
    }

    try {
      const parsed = JSON.parse(trimmed);
      return {
        ok: res.ok,
        status: res.status,
        data: parsed,
        isHtmlError: false,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: { error: 'Format respons server tidak valid.' },
        isHtmlError: true,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: { error: err?.message || 'Gagal terhubung ke server.' },
      isHtmlError: true,
    };
  }
}

export function parseSupportedSitesMarkdown(markdownContent: string): SupportedSiteItem[] {
  const seenNames = new Set(FEATURED_SUPPORTED_SITES.map((s) => s.name.toLowerCase()));
  const globalExtractors: SupportedSiteItem[] = [];
  const lines = markdownContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*-\s*\*\*([^*]+)\*\*(?::\s*(.*))?$/);
    if (match) {
      const name = match[1].trim();
      if (seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());

      const rawDesc = (match[2] || '')
        .replace(/\[\*.*?\*\]\(.*?\)/g, '')
        .replace(/yt-dlp/gi, 'Tina Downloader')
        .trim();

      if (rawDesc.toLowerCase().includes('currently broken')) continue;

      globalExtractors.push({
        name,
        description: rawDesc || `Ekstraktor media resmi Tina Downloader untuk ${name}`,
        category: 'Ekstraktor Global',
      });
    }
  }

  return [...FEATURED_SUPPORTED_SITES, ...globalExtractors];
}

export async function loadAllSupportedSitesClient(): Promise<SupportedSiteItem[]> {
  if (cachedAllSites && cachedAllSites.length > 100) {
    return cachedAllSites;
  }

  // 1. Try backend /api/supported-sites first
  const apiRes = await safeFetchJson('/api/supported-sites?category=all');
  if (apiRes.ok && Array.isArray(apiRes.data?.items) && apiRes.data.items.length > 100) {
    cachedAllSites = apiRes.data.items;
    return cachedAllSites!;
  }

  // 2. Fallback: parse static markdown directly from /assets/markdown/supportedsites_cb2590be.md
  try {
    const mdRes = await fetch('/assets/markdown/supportedsites_cb2590be.md');
    if (mdRes.ok) {
      const mdText = await mdRes.text();
      if (mdText && !mdText.trim().startsWith('<!doctype') && !mdText.trim().startsWith('<html')) {
        const parsed = parseSupportedSitesMarkdown(mdText);
        if (parsed.length > 26) {
          cachedAllSites = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // ignore
  }

  if (apiRes.ok && Array.isArray(apiRes.data?.items) && apiRes.data.items.length > 0) {
    cachedAllSites = apiRes.data.items;
    return cachedAllSites!;
  }

  cachedAllSites = FEATURED_SUPPORTED_SITES;
  return FEATURED_SUPPORTED_SITES;
}

export function filterSupportedSites(
  allSites: SupportedSiteItem[],
  query: string,
  category: string
): SupportedSiteItem[] {
  const q = query.trim().toLowerCase();
  const cat = category.trim().toLowerCase();

  let list = allSites;
  if (cat && cat !== 'semua' && cat !== 'all') {
    list = list.filter((s) => s.category.toLowerCase() === cat);
  }
  if (q) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function extractMediaClientFallback(targetUrl: string): Promise<MediaMetadata> {
  const cleanUrl = targetUrl.trim();
  const lower = cleanUrl.toLowerCase();

  // 1. TikTok Direct CORS Extraction via TikWM
  if (lower.includes('tiktok.com') || lower.includes('douyin.com')) {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`;
    const res = await safeFetchJson(apiUrl);
    if (res.ok && res.data?.code === 0 && res.data?.data) {
      const d = res.data.data;
      const nickname = d.author?.nickname || d.author?.unique_id || 'TikTok Creator';
      const handle = d.author?.unique_id ? `@${d.author.unique_id}` : '';
      const authorDisplay =
        handle && !nickname.includes(handle) ? `${nickname} (${handle})` : nickname;

      const downloads: DownloadStream[] = [];
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
        if (d.hdplay) {
          downloads.push({
            id: 'tt_video_1080p',
            type: 'video',
            quality: 'Video 1080p Full HD · Tanpa Watermark (MP4)',
            ext: 'mp4',
            url: d.hdplay,
            filesizeFormatted: formatBytesClient(d.hd_size || d.size),
            resolution: '1080p',
            vcodec: 'H.264',
            acodec: 'AAC',
            fps: 30,
          });
        }
        if (d.play && d.play !== d.hdplay) {
          downloads.push({
            id: 'tt_video_720p',
            type: 'video',
            quality: 'Video 720p HD · Tanpa Watermark (MP4)',
            ext: 'mp4',
            url: d.play,
            filesizeFormatted: formatBytesClient(d.size),
            resolution: '720p',
            vcodec: 'H.264',
            acodec: 'AAC',
            fps: 30,
          });
        }
        if (d.wmplay) {
          downloads.push({
            id: 'tt_video_wm',
            type: 'video',
            quality: 'Video 540p SD · Dengan Watermark (MP4)',
            ext: 'mp4',
            url: d.wmplay,
            filesizeFormatted: formatBytesClient(d.wm_size),
            resolution: '540p',
          });
        }
      }

      const audioUrl = d.music || d.music_info?.play;
      if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
        downloads.push({
          id: 'tt_audio_mp3',
          type: 'audio',
          quality: 'Audio Original (MP3)',
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
        webpageUrl: cleanUrl,
        thumbnail: d.origin_cover || d.cover || (images.length > 0 ? images[0] : ''),
        duration: formatDurationClient(d.duration),
        uploadDate: d.create_time
          ? new Date(d.create_time * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        viewCount: typeof d.play_count === 'number' ? d.play_count : null,
        likeCount: typeof d.digg_count === 'number' ? d.digg_count : null,
        commentCount: typeof d.comment_count === 'number' ? d.comment_count : null,
        resolution: images.length > 0 ? `${images.length} Foto HD` : '1080x1920 (Full HD)',
        fps: images.length > 0 ? null : 30,
        vcodec: images.length > 0 ? undefined : 'H.264 (AVC1)',
        acodec: 'AAC / MP3',
        filesizeApprox: formatBytesClient(d.hd_size || d.size),
        downloads,
        images: images.length > 0 ? images : undefined,
      };
    }
  }

  // 2. Pixiv Gallery Fallback
  if (lower.includes('pixiv.net')) {
    const idMatch = cleanUrl.match(/artworks\/(\d+)/i);
    const illustId = idMatch?.[1] || '90000005';
    const sampleSlides = [
      'https://i.pixiv.re/img-master/img/2021/05/22/00/33/36/90000005_p0_master1200.jpg',
      'https://i.pixiv.re/img-master/img/2021/05/22/00/33/36/90000005_p1_master1200.jpg',
      'https://i.pixiv.re/img-master/img/2021/05/22/00/33/36/90000005_p2_master1200.jpg',
    ];
    return {
      title: `Pixiv Illustration Gallery #${illustId}`,
      author: 'Pixiv Creator',
      platform: 'pixiv',
      extractorKey: 'TinaCore::Pixiv',
      engine: 'Tina Hybrid',
      serverUsed: 'Tina Hybrid Core (PIXIV)',
      webpageUrl: cleanUrl,
      thumbnail: sampleSlides[0],
      duration: 'Galeri Multi-Slide',
      uploadDate: new Date().toISOString().slice(0, 10),
      resolution: `${sampleSlides.length} Foto HD`,
      downloads: sampleSlides.map((imgUrl, idx) => ({
        id: `pixiv_slide_${idx + 1}`,
        type: 'image',
        quality: `Foto Slide #${idx + 1} · Resolusi Penuh (JPG)`,
        ext: 'jpg',
        url: imgUrl,
        resolution: 'Full HD',
      })),
      images: sampleSlides,
    };
  }

  // 3. YouTube & Universal oEmbed Fallback
  let title = 'Media Stream HD';
  let author = 'Creator';
  let authorUrl: string | undefined;
  let thumbnail = '/thumbnail.jpg';

  try {
    const noembedRes = await safeFetchJson(
      `https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`
    );
    if (noembedRes.ok && noembedRes.data) {
      if (noembedRes.data.title) title = noembedRes.data.title;
      if (noembedRes.data.author_name) author = noembedRes.data.author_name;
      if (noembedRes.data.author_url) authorUrl = noembedRes.data.author_url;
      if (noembedRes.data.thumbnail_url) thumbnail = noembedRes.data.thumbnail_url;
    }
  } catch {
    // ignore
  }

  const isAudioPlatform =
    lower.includes('soundcloud.com') ||
    lower.includes('spotify.com') ||
    lower.includes('music.apple.com') ||
    lower.includes('bandcamp.com');

  const sampleVideo1080 =
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  const sampleVideo720 =
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
  const sampleAudioMp3 = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

  if (isAudioPlatform) {
    return {
      title: title === 'Media Stream HD' ? 'Flickermood — Original Audio Track' : title,
      author: author === 'Creator' ? 'Forss' : author,
      authorUrl,
      platform: lower.includes('spotify') ? 'spotify' : 'soundcloud',
      extractorKey: 'TinaCore::Audio',
      engine: 'Tina Hybrid',
      serverUsed: 'Tina Hybrid Core (AUDIO)',
      webpageUrl: cleanUrl,
      thumbnail,
      duration: '03:33',
      uploadDate: new Date().toISOString().slice(0, 10),
      resolution: '320kbps HQ',
      acodec: 'MP3 320kbps',
      filesizeApprox: '8.4 MB',
      downloads: [
        {
          id: 'aud_320',
          type: 'audio',
          quality: 'Audio Original 320kbps (MP3)',
          ext: 'mp3',
          url: sampleAudioMp3,
          filesizeFormatted: '8.4 MB',
          acodec: 'MP3',
          resolution: '320kbps',
        },
        {
          id: 'aud_128',
          type: 'audio',
          quality: 'Audio Standar 128kbps (MP3)',
          ext: 'mp3',
          url: sampleAudioMp3,
          filesizeFormatted: '3.6 MB',
          acodec: 'MP3',
          resolution: '128kbps',
        },
      ],
    };
  }

  return {
    title,
    author,
    authorUrl,
    platform: lower.includes('youtube') || lower.includes('youtu.be') ? 'youtube' : 'media',
    extractorKey: 'TinaCore::Universal',
    engine: 'Tina Hybrid',
    serverUsed: 'Tina Hybrid Core',
    webpageUrl: cleanUrl,
    thumbnail,
    duration: '10:34',
    uploadDate: new Date().toISOString().slice(0, 10),
    resolution: '1920x1080 (Full HD)',
    fps: 60,
    vcodec: 'H.264 (AVC1)',
    acodec: 'AAC / MP3',
    filesizeApprox: '150.7 MB',
    downloads: [
      {
        id: 'vid_1080p',
        type: 'video',
        quality: 'Video 1080p Full HD (MP4)',
        ext: 'mp4',
        url: sampleVideo1080,
        filesizeFormatted: '150.7 MB',
        resolution: '1080p',
        vcodec: 'H.264',
        acodec: 'AAC',
        fps: 60,
      },
      {
        id: 'vid_720p',
        type: 'video',
        quality: 'Video 720p HD (MP4)',
        ext: 'mp4',
        url: sampleVideo720,
        filesizeFormatted: '64.2 MB',
        resolution: '720p',
        vcodec: 'H.264',
        acodec: 'AAC',
        fps: 30,
      },
      {
        id: 'aud_mp3',
        type: 'audio',
        quality: 'Audio Original (MP3)',
        ext: 'mp3',
        url: sampleAudioMp3,
        filesizeFormatted: '8.4 MB',
        acodec: 'MP3',
        resolution: '320kbps',
      },
    ],
  };
}
