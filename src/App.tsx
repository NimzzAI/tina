import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getDeviceId } from './utils/deviceFingerprint';
import { V10VideoPlayer, V10AudioPlayer } from './components/V10MediaPlayer';
import { ApiDocsPage } from './components/ApiDocsPage';
import { DeveloperPage } from './components/DeveloperPage';
import {
  INITIAL_ALL_SUPPORTED_SITES,
  loadAllSupportedSitesClient,
  filterSupportedSites,
  safeFetchJson,
  extractMediaClientFallback,
} from './utils/clientFallback';
import {
  MediaMetadata,
  DownloadStream,
  HistoryItem,
  SupportedSiteItem,
} from './types';

type ActiveTab = 'downloader' | 'history' | 'sites' | 'api-docs' | 'about' | 'developer';
type ResultSubTab = 'streams' | 'info';
type PreviewMode = 'video' | 'carousel' | 'audio' | 'cover';

const VALID_TABS: ActiveTab[] = [
  'downloader',
  'history',
  'sites',
  'api-docs',
  'about',
  'developer',
];

function resolveInitialActiveTab(): ActiveTab {
  if (typeof window === 'undefined') return 'downloader';
  try {
    const pathSeg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (VALID_TABS.includes(pathSeg as ActiveTab)) {
      return pathSeg as ActiveTab;
    }

    const hashSeg = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (VALID_TABS.includes(hashSeg as ActiveTab)) {
      return hashSeg as ActiveTab;
    }

    const params = new URLSearchParams(window.location.search);
    const queryTab = (params.get('tab') || '').toLowerCase();
    if (VALID_TABS.includes(queryTab as ActiveTab)) {
      return queryTab as ActiveTab;
    }

    const savedTab = localStorage.getItem('tina_active_tab');
    if (savedTab && VALID_TABS.includes(savedTab as ActiveTab)) {
      return savedTab as ActiveTab;
    }
  } catch {
    // ignore storage/location errors
  }
  return 'downloader';
}

const NIMZZ_SOCIAL_ACCOUNTS = [
  {
    platform: 'WhatsApp Channel',
    handle: 'Saluran Resmi Nimzz',
    description: 'Informasi update fitur terbaru & pengumuman resmi Tina Downloader',
    icon: 'fa-brands fa-whatsapp',
    url: 'https://whatsapp.com/channel/0029VbBhZWdGJP8HlbGaE63Q',
  },
  {
    platform: 'GitHub',
    handle: 'NimzzAi',
    description: 'Repositori proyek, kode sumber & pengembangan sistem oleh Nimzz',
    icon: 'fa-brands fa-github',
    url: 'https://github.com/NimzzAi',
  },
  {
    platform: 'Telegram',
    handle: '@Nimzz4',
    description: 'Kontak langsung & saluran diskusi bersama pengembang',
    icon: 'fa-brands fa-telegram',
    url: 'https://t.me/Nimzz4',
  },
  {
    platform: 'TikTok',
    handle: '@nimzz_bocil_pokemon',
    description: 'Konten kreator, showcase web tools & update seputar proyek',
    icon: 'fa-brands fa-tiktok',
    url: 'https://www.tiktok.com/@nimzz_bocil_pokemon',
  },
];

const QUICK_TEST_LINKS = [
  {
    label: 'TikTok Video & Audio',
    icon: 'fa-brands fa-tiktok',
    url: 'https://vm.tiktok.com/ZSgCBT3wv/',
  },
  {
    label: 'Video Multi-Resolusi',
    icon: 'fa-brands fa-youtube',
    url: 'https://youtu.be/Sgt6yH9UM-c?si=dUP74ef5pdgEShXX',
  },
  {
    label: 'Audio Track Spotify',
    icon: 'fa-brands fa-spotify',
    url: 'https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ',
  },
  {
    label: 'Galeri Foto Carousel',
    icon: 'fa-regular fa-images',
    url: 'https://www.pixiv.net/en/artworks/90000005',
  },
];

const SITE_CATEGORIES = [
  'Semua',
  'Sosial & Video',
  'Musik & Audio',
  'Cloud & Berkas',
  'Komik & Anime',
  'Ekstraktor Global',
];

const FAQ_ITEMS = [
  {
    question: 'Apa itu Tina Downloader dan bagaimana cara menggunakannya?',
    answer:
      'Tina Downloader adalah layanan web untuk mengunduh video, musik, galeri foto carousel, berkas cloud, hingga komik dari lebih dari 1.600 situs secara instan. Cukup tempel tautan pada kolom input, lalu pilih resolusi video, audio MP3, atau foto yang ingin Anda simpan.',
  },
  {
    question: 'Apakah unduhan video TikTok dan Instagram bebas watermark?',
    answer:
      'Ya. Untuk platform seperti TikTok, Instagram, Douyin, CapCut, dan RedNote, Tina Downloader secara otomatis menyediakan video resolusi asli (1080p Full HD & 720p HD) tanpa watermark sekaligus menyediakan opsi unduhan audio MP3 terpisah.',
  },
  {
    question: 'Bagaimana jika tautan yang diunduh berupa foto atau galeri slide?',
    answer:
      'Jika tautan berisi foto tunggal maupun galeri multi-slide (carousel), Tina Downloader otomatis menampilkan Photo Carousel interaktif lengkap dengan navigasi slide, pratinjau layar penuh, tombol unduh per foto (.JPG), serta fitur gabung seluruh foto menjadi satu berkas PDF.',
  },
  {
    question: 'Apakah tersedia dokumentasi API untuk pengembang?',
    answer:
      'Ya. Bagi pengguna yang membutuhkan integrasi koding, endpoint REST API, contoh kode (cURL, JavaScript, Python, Go), maupun inspeksi Raw JSON, seluruhnya telah dipisahkan secara khusus pada halaman Dokumentasi API di menu navigasi.',
  },
  {
    question: 'Apakah saya perlu membuat akun atau login untuk melihat riwayat unduhan?',
    answer:
      'Tidak perlu login. Riwayat unduhan Anda tersimpan secara otomatis dan dapat dibuka kembali kapan saja melalui menu Riwayat Unduhan.',
  },
];

function buildProxyStreamUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  const lower = rawUrl.toLowerCase();
  if (
    lower.includes('spotidown.app') ||
    lower.includes('gammacloud.net') ||
    lower.includes('cnvmp3.com') ||
    (lower.includes('theresav.eu') && lower.endsWith('.mp3'))
  ) {
    return `/api/proxy-stream?url=${encodeURIComponent(rawUrl)}&ext=mp3`;
  }
  const needsRefererProxy =
    lower.includes('pximg.net') ||
    lower.includes('hdslb.com') ||
    lower.includes('bilivideo.com') ||
    lower.includes('xhscdn.com') ||
    lower.includes('sinaimg.cn') ||
    lower.includes('piped.private.coffee') ||
    lower.includes('_resolve:');
  if (needsRefererProxy) {
    return `/api/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

export default function App() {
  // Theme state (Dark / Light)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tina_dark_mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('tina_dark_mode', String(darkMode));
    } catch {
      // ignore
    }
  }, [darkMode]);

  // Navigation & Three-Dots Menu state (persisted across refresh & URL history)
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => resolveInitialActiveTab());
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setActiveTab = useCallback((nextTab: ActiveTab) => {
    setActiveTabState(nextTab);
    try {
      localStorage.setItem('tina_active_tab', nextTab);
      const targetPath = nextTab === 'downloader' ? '/' : `/${nextTab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab: nextTab }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  }, []);

  // Keep URL & localStorage synced on initial load and browser Back/Forward
  useEffect(() => {
    try {
      localStorage.setItem('tina_active_tab', activeTab);
      const targetPath = activeTab === 'downloader' ? '/' : `/${activeTab}`;
      if (window.location.pathname !== targetPath) {
        window.history.replaceState({ tab: activeTab }, '', targetPath);
      }
    } catch {
      // ignore
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const stateTab = event.state?.tab;
      if (stateTab && VALID_TABS.includes(stateTab)) {
        setActiveTabState(stateTab);
        try {
          localStorage.setItem('tina_active_tab', stateTab);
        } catch {
          // ignore
        }
        return;
      }
      const pathSeg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (VALID_TABS.includes(pathSeg as ActiveTab)) {
        setActiveTabState(pathSeg as ActiveTab);
      } else {
        setActiveTabState('downloader');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Silent security fingerprint (background header only)
  const [deviceId] = useState<string>(() => getDeviceId());

  // Downloader state (with session persistence so accidental refresh keeps last extraction)
  const [urlInput, setUrlInput] = useState<string>(() => {
    try {
      return sessionStorage.getItem('tina_last_url_input') || '';
    } catch {
      return '';
    }
  });
  const [extracting, setExtracting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [mediaResult, setMediaResult] = useState<MediaMetadata | null>(() => {
    try {
      const cached = sessionStorage.getItem('tina_last_media_result');
      return cached ? (JSON.parse(cached) as MediaMetadata) : null;
    } catch {
      return null;
    }
  });
  const [resultSubTab, setResultSubTab] = useState<ResultSubTab>('streams');
  const [streamFilter, setStreamFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [resolvingStreamId, setResolvingStreamId] = useState<string | null>(null);
  const [compilingPdf, setCompilingPdf] = useState<boolean>(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('tina_last_url_input', urlInput);
    } catch {
      // ignore
    }
  }, [urlInput]);

  useEffect(() => {
    try {
      if (mediaResult) {
        sessionStorage.setItem('tina_last_media_result', JSON.stringify(mediaResult));
      }
    } catch {
      // ignore
    }
  }, [mediaResult]);

  // Interactive V10 Player & Carousel state
  const [previewMode, setPreviewMode] = useState<PreviewMode>('video');
  const [activeVideoStream, setActiveVideoStream] = useState<DownloadStream | null>(null);
  const [activeAudioStream, setActiveAudioStream] = useState<DownloadStream | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // History & Extractors state
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('tina_local_history_v1');
      return saved ? (JSON.parse(saved) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [historySort, setHistorySort] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [allSites, setAllSites] = useState<SupportedSiteItem[]>(INITIAL_ALL_SUPPORTED_SITES);
  const [totalExtractors, setTotalExtractors] = useState<number>(
    INITIAL_ALL_SUPPORTED_SITES.length || 1615
  );
  const [siteSearch, setSiteSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [loadingSites, setLoadingSites] = useState<boolean>(false);
  const [sitesDisplayLimit, setSitesDisplayLimit] = useState<number>(250);

  // FAQ Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Public asset fallback state
  const [logoSrc, setLogoSrc] = useState<string>('/logo.png');
  const [thumbError, setThumbError] = useState<boolean>(false);

  // Persist history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tina_local_history_v1', JSON.stringify(historyItems.slice(0, 60)));
    } catch {
      // ignore
    }
  }, [historyItems]);

  // Close Three-Dots menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Categorized streams & carousel images
  const videoStreams = useMemo(
    () => (mediaResult?.downloads || []).filter((s) => s.type === 'video'),
    [mediaResult]
  );

  const audioStreams = useMemo(
    () => (mediaResult?.downloads || []).filter((s) => s.type === 'audio'),
    [mediaResult]
  );

  const imageStreams = useMemo(
    () => (mediaResult?.downloads || []).filter((s) => s.type === 'image'),
    [mediaResult]
  );

  const carouselImages = useMemo(() => {
    if (mediaResult?.images && mediaResult.images.length > 0) {
      return mediaResult.images;
    }
    const isAudioPlat = ['spotify', 'soundcloud', 'applemusic', 'bandcamp'].includes(
      (mediaResult?.platform || '').toLowerCase()
    );
    if (!isAudioPlat && videoStreams.length === 0 && imageStreams.length > 0) {
      return imageStreams.map((s) => s.url);
    }
    return [];
  }, [mediaResult, imageStreams, videoStreams]);

  useEffect(() => {
    if (!mediaResult) return;
    const vids = (mediaResult.downloads || []).filter((s) => s.type === 'video');
    const auds = (mediaResult.downloads || []).filter((s) => s.type === 'audio');
    const plat = (mediaResult.platform || '').toLowerCase();
    const isAudioPlat = ['spotify', 'soundcloud', 'applemusic', 'bandcamp'].includes(plat);
    const imgs =
      mediaResult.images && mediaResult.images.length > 0
        ? mediaResult.images
        : !isAudioPlat && vids.length === 0
          ? (mediaResult.downloads || []).filter((s) => s.type === 'image').map((s) => s.url)
          : [];

    setCarouselIndex(0);
    setLightboxOpen(false);
    setActiveVideoStream(vids[0] || null);
    setActiveAudioStream(auds[0] || null);

    if (isAudioPlat && auds.length > 0) {
      setPreviewMode('audio');
    } else if (imgs.length > 0) {
      setPreviewMode('carousel');
    } else if (vids.length > 0) {
      setPreviewMode('video');
    } else if (auds.length > 0) {
      setPreviewMode('audio');
    } else {
      setPreviewMode('cover');
    }
  }, [mediaResult]);

  // Sync History silently from backend (safe JSON parsing)
  const refreshHistory = useCallback(async () => {
    try {
      const headers = { 'X-Device-ID': deviceId };
      const { ok, data } = await safeFetchJson('/api/history', { headers });
      if (ok && data && Array.isArray(data.items) && data.items.length > 0) {
        setHistoryItems((prev) => {
          const map = new Map<string, HistoryItem>();
          for (const item of [...data.items, ...prev]) {
            if (item && item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          }
          return Array.from(map.values());
        });
      }
    } catch {
      // ignore
    }
  }, [deviceId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Load full supported sites list once (with markdown fallback so it never fails)
  useEffect(() => {
    let active = true;
    setLoadingSites(true);
    loadAllSupportedSitesClient()
      .then(({ items, total }) => {
        if (!active) return;
        if (Array.isArray(items) && items.length > 0) {
          setAllSites(items);
          setTotalExtractors(total || items.length);
        }
      })
      .catch(() => {
        // fallback already handled in loadAllSupportedSitesClient
      })
      .finally(() => {
        if (active) setLoadingSites(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Reset display limit when search or category changes
  useEffect(() => {
    setSitesDisplayLimit(250);
  }, [siteSearch, selectedCategory]);

  // Filtered supported sites computed instantaneously
  const supportedSites = useMemo(
    () => filterSupportedSites(allSites, siteSearch, selectedCategory),
    [allSites, siteSearch, selectedCategory]
  );

  // Extract Media Handler (safe against HTML/Unexpected token errors + client fallback)
  const handleExtract = async (customUrl?: string) => {
    const targetUrl = (customUrl ?? urlInput).trim();
    if (!targetUrl) {
      setErrorMessage('Silakan tempelkan tautan URL media terlebih dahulu.');
      return;
    }

    setExtracting(true);
    setErrorMessage(null);
    setStatusNotice(null);

    try {
      const { ok, data: payload } = await safeFetchJson('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      let extractedData: MediaMetadata | null = null;
      let newHistoryItem: HistoryItem | null = null;

      if (ok && payload?.data) {
        extractedData = payload.data as MediaMetadata;
        newHistoryItem = (payload.historyItem as HistoryItem) || null;
      } else {
        // Try client-side fallback if backend returned non-JSON or failed
        extractedData = await extractMediaClientFallback(targetUrl);
      }

      if (!extractedData) {
        throw new Error(payload?.error || 'Gagal memproses tautan.');
      }

      setMediaResult(extractedData);
      setResultSubTab('streams');
      setStreamFilter('all');

      const historyEntry: HistoryItem = newHistoryItem || {
        id: `hist_${Date.now()}`,
        url: targetUrl,
        title: extractedData.title || 'Media',
        thumbnail: extractedData.thumbnail || '',
        platform: extractedData.platform || 'WEB',
        author: extractedData.author || 'Kreator',
        duration: extractedData.duration || extractedData.durationString || '--:--',
        quality: extractedData.resolution || extractedData.downloads?.[0]?.quality || 'HD',
        createdAt: new Date().toISOString(),
        metadata: extractedData,
      };

      setHistoryItems((prev) => [
        historyEntry,
        ...prev.filter((p) => p.id !== historyEntry.id && p.url !== historyEntry.url),
      ]);

      refreshHistory();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengekstrak media. Pastikan tautan bersifat publik.');
    } finally {
      setExtracting(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage('Izin clipboard tidak tersedia. Silakan tempel manual (Ctrl+V).');
    }
  };

  const handleDownloadStream = async (stream: DownloadStream, customIndex?: number) => {
    if (!mediaResult) return;
    setErrorMessage(null);
    const activeKey = stream.id || `${stream.quality}_${customIndex ?? 0}`;
    setResolvingStreamId(activeKey);

    try {
      let targetStreamUrl = stream.url;
      if (stream.needsResolve) {
        setStatusNotice(`Menyiapkan berkas ${stream.quality}...`);
        const { ok, data } = await safeFetchJson('/api/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-ID': deviceId,
          },
          body: JSON.stringify({ tokenUrl: stream.url }),
        });
        if (!ok || !data?.url) {
          throw new Error(data?.error || 'Gagal melakukan resolve media.');
        }
        targetStreamUrl = data.url;
      }

      const cleanExt = (
        stream.ext ||
        (stream.type === 'audio' ? 'mp3' : stream.type === 'image' ? 'jpg' : 'mp4')
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      const suffix =
        stream.type === 'image' && typeof customIndex === 'number'
          ? `_Slide_${customIndex + 1}`
          : stream.resolution
            ? `_${stream.resolution.replace(/[^a-zA-Z0-9]/g, '')}`
            : '';

      const cleanTitleBase =
        mediaResult.title
          .replace(/[^a-zA-Z0-9_\-\s]/g, ' ')
          .trim()
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 50) || 'Media';

      const finalFileName = `Tina_${cleanTitleBase}${suffix}.${cleanExt}`;

      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        pdf: 'application/pdf',
      };
      const explicitMime = mimeMap[cleanExt] || 'video/mp4';

      const downloadEndpoint = `/api/download/${encodeURIComponent(
        finalFileName
      )}?url=${encodeURIComponent(targetStreamUrl)}&filename=${encodeURIComponent(
        `Tina_${cleanTitleBase}${suffix}`
      )}&ext=${encodeURIComponent(cleanExt)}`;

      setStatusNotice(`Mengunduh ${finalFileName}...`);

      try {
        const resp = await fetch(downloadEndpoint, {
          headers: { 'X-Device-ID': deviceId },
        });

        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        if (!resp.ok || contentType.includes('application/json') || contentType.includes('text/html')) {
          throw new Error('Fallback direct download');
        }

        const contentLength = Number(resp.headers.get('content-length') || 0);
        if (resp.body && contentLength > 0 && contentLength < 150 * 1024 * 1024) {
          const reader = resp.body.getReader();
          const chunks: BlobPart[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              const pct = Math.min(99, Math.round((received / contentLength) * 100));
              setStatusNotice(`Mengunduh ${finalFileName} (${pct}%)...`);
            }
          }

          const blob = new Blob(chunks, { type: explicitMime });
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = finalFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
        } else {
          const arrayBuf = await resp.arrayBuffer();
          const blob = new Blob([arrayBuf], { type: explicitMime });
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = finalFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
        }
      } catch {
        // Fallback for serverless 4.5MB limit or CORS redirect: direct browser download
        const link = document.createElement('a');
        link.href = targetStreamUrl;
        link.download = finalFileName;
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setStatusNotice(`Berhasil menyiapkan unduhan: ${finalFileName}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memulai unduhan.');
    } finally {
      setResolvingStreamId(null);
    }
  };

  const handleDownloadSlideImage = (imgUrl: string, index: number) => {
    if (!mediaResult) return;
    handleDownloadStream(
      {
        id: `slide_${index + 1}`,
        type: 'image',
        quality: `Foto Slide #${index + 1} (JPG)`,
        ext: 'jpg',
        url: imgUrl,
        resolution: `Slide_${index + 1}`,
      },
      index
    );
  };

  const handleCompilePdf = async () => {
    if (carouselImages.length === 0 || !mediaResult) return;
    setCompilingPdf(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({
          images: carouselImages,
          title: mediaResult.title,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal mengompilasi PDF.');
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Tina_${mediaResult.title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 50)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setStatusNotice(`Berhasil menggabungkan ${carouselImages.length} foto ke dokumen PDF.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal membuat dokumen PDF.');
    } finally {
      setCompilingPdf(false);
    }
  };

  const handleCopySourceLink = async () => {
    if (!mediaResult?.webpageUrl) return;
    try {
      await navigator.clipboard.writeText(mediaResult.webpageUrl);
      setStatusNotice('Tautan sumber asli berhasil disalin.');
    } catch {
      setErrorMessage('Gagal menyalin tautan.');
    }
  };

  const classifyHistoryItemType = useCallback((item: HistoryItem): 'video' | 'audio' | 'image' => {
    const plat = (item.platform || '').toLowerCase();
    const qual = (item.quality || '').toLowerCase();
    const firstType = item.metadata?.downloads?.[0]?.type;
    if (
      ['spotify', 'soundcloud', 'applemusic', 'bandcamp'].includes(plat) ||
      firstType === 'audio' ||
      qual.includes('kbps') ||
      qual.includes('mp3') ||
      qual.includes('audio')
    ) {
      return 'audio';
    }
    if (
      ['pixiv', 'pinterest', 'mangadex'].includes(plat) ||
      (item.metadata?.images && item.metadata.images.length > 0) ||
      firstType === 'image' ||
      qual.includes('foto') ||
      qual.includes('slide')
    ) {
      return 'image';
    }
    return 'video';
  }, []);

  const historyStats = useMemo(() => {
    let video = 0;
    let audio = 0;
    let image = 0;
    for (const item of historyItems) {
      const t = classifyHistoryItemType(item);
      if (t === 'audio') audio++;
      else if (t === 'image') image++;
      else video++;
    }
    return {
      total: historyItems.length,
      video,
      audio,
      image,
    };
  }, [historyItems, classifyHistoryItemType]);

  const filteredHistory = useMemo(() => {
    let list = [...historyItems];
    if (historyCategoryFilter !== 'all') {
      list = list.filter((item) => classifyHistoryItemType(item) === historyCategoryFilter);
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q) ||
          item.platform.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (historySort === 'title') {
        return a.title.localeCompare(b.title, 'id-ID');
      }
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return historySort === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [historyItems, historyCategoryFilter, historySearch, historySort, classifyHistoryItemType]);

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await fetch(`/api/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-Device-ID': deviceId },
      });
      setHistoryItems((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  const handleClearAllHistory = async () => {
    try {
      await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'X-Device-ID': deviceId },
      });
      setHistoryItems([]);
      setStatusNotice('Seluruh riwayat unduhan telah dibersihkan.');
    } catch {
      // ignore
    }
  };

  const handleExportHistoryJson = () => {
    if (historyItems.length === 0) return;
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalItems: historyItems.length,
        items: historyItems,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tina_history_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusNotice(`Berhasil mengekspor ${historyItems.length} riwayat ke berkas JSON.`);
  };

  const handleCopyHistoryUrl = async (id: string, targetUrl: string) => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedHistoryId(id);
      setTimeout(() => setCopiedHistoryId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // ignore
    }
  };

  const filteredStreams = useMemo(() => {
    if (!mediaResult?.downloads) return [];
    if (streamFilter === 'all') return mediaResult.downloads;
    return mediaResult.downloads.filter((s) => s.type === streamFilter);
  }, [mediaResult, streamFilter]);

  const menuItems: { id: ActiveTab; label: string; desc: string; icon: string }[] = [
    {
      id: 'downloader',
      label: 'Beranda Unduhan',
      desc: 'Unduh video, musik & galeri foto',
      icon: 'fa-solid fa-arrow-down',
    },
    {
      id: 'history',
      label: `Riwayat Unduhan (${historyItems.length})`,
      desc: 'Daftar media yang pernah Anda unduh',
      icon: 'fa-solid fa-clock-rotate-left',
    },
    {
      id: 'sites',
      label: `Daftar Situs (${totalExtractors.toLocaleString('id-ID')})`,
      desc: 'Direktori seluruh platform yang didukung',
      icon: 'fa-solid fa-globe',
    },
    {
      id: 'api-docs',
      label: 'Dokumentasi API',
      desc: 'Endpoint REST API, kode & JSON',
      icon: 'fa-solid fa-terminal',
    },
    {
      id: 'about',
      label: 'Tentang & FAQ',
      desc: 'Panduan penggunaan & tanya jawab',
      icon: 'fa-solid fa-circle-question',
    },
    {
      id: 'developer',
      label: 'Profile Developer — Nimzz',
      desc: 'Kreator & saluran sosial resmi',
      icon: 'fa-solid fa-user',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-paper text-neutral-950 dark:bg-paper dark:text-neutral-50 transition-colors duration-200">
      {/* Top SaaS Header Bar (Monochrome Black/White/Gray) */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-paper/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          {/* Brand Logo (PNG/JPG) + Wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('downloader');
              setMenuOpen(false);
            }}
            className="flex items-center gap-3 text-left cursor-pointer group"
          >
            <img
              src={logoSrc}
              alt="Tina Downloader Logo"
              onError={() => {
                if (logoSrc !== '/logo.jpg') setLogoSrc('/logo.jpg');
              }}
              className="w-8 h-8 rounded-lg object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
            />
            <span className="font-display text-[15px] font-bold tracking-tight text-neutral-950 dark:text-white">
              Tina Downloader
            </span>
          </button>

          {/* Right Action Area: Dark Mode Toggle + Three Dots Menu */}
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Toggle Dark Mode"
              className="h-9 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-surface text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer"
            >
              <i className={darkMode ? 'fa-solid fa-sun text-xs' : 'fa-solid fa-moon text-xs'} />
              <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            {/* Three Dots Navigation Trigger */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Menu Navigasi"
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                menuOpen
                  ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-white dark:text-neutral-950 dark:border-white'
                  : 'bg-white dark:bg-surface text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <i className="fa-solid fa-ellipsis-vertical text-xs" />
            </button>

            {/* Monochrome SaaS Dropdown Menu */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-12 w-72 bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-1.5 z-50"
                >
                  <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <span>Menu</span>
                    <span>{totalExtractors.toLocaleString('id-ID')} situs</span>
                  </div>

                  <div className="py-1 space-y-0.5">
                    {menuItems.map((item) => {
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            setMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left flex items-start gap-3 transition-colors cursor-pointer ${
                            active
                              ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                          }`}
                        >
                          <i className={`${item.icon} text-xs mt-1 w-4 text-center shrink-0`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold leading-snug">{item.label}</div>
                            <div
                              className={`text-[11px] truncate mt-0.5 ${
                                active
                                  ? 'text-neutral-300 dark:text-neutral-600'
                                  : 'text-neutral-500 dark:text-neutral-400'
                              }`}
                            >
                              {item.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Monochrome Notification Banner */}
        <AnimatePresence mode="wait">
          {errorMessage && (
            <motion.div
              key="err-toast"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
              className="mb-6 px-4 py-3 border border-neutral-900 dark:border-neutral-200 bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-xl flex items-center justify-between gap-4 text-xs font-medium"
            >
              <span>
                <i className="fa-solid fa-triangle-exclamation mr-2" />
                {errorMessage}
              </span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </motion.div>
          )}

          {statusNotice && (
            <motion.div
              key="status-toast"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
              className="mb-6 px-4 py-3 border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-surface rounded-xl flex items-center justify-between gap-4 text-xs text-neutral-800 dark:text-neutral-200"
            >
              <span>
                <i className="fa-solid fa-check mr-2" />
                {statusNotice}
              </span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* =========================================================
              VIEW 1: BERANDA UNDUHAN (CLEAN USER-FRIENDLY DOWNLOADER — ZERO CODING METADATA)
             ========================================================= */}
          {activeTab === 'downloader' && (
            <motion.div
              key="view-downloader"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-8"
            >
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
                <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
                  <div className="space-y-3">
                    <h1 className="text-2xl sm:text-4xl font-bold leading-[1.15] text-neutral-950 dark:text-white text-balance">
                      Tempel tautan, pilih kualitas, lalu unduh.
                    </h1>
                    <p className="text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400 max-w-[46ch]">
                      Video, musik, dan foto dari TikTok, YouTube, Instagram, Spotify, X, Pixiv, dan {totalExtractors.toLocaleString('id-ID')}+ situs lainnya.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-white dark:bg-surface border-2 border-neutral-300 dark:border-neutral-700 rounded-xl focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/20 transition-shadow">
                      <div className="relative flex-1 flex items-center min-w-0">
                        <i className="fa-solid fa-link pl-3 pr-2 text-neutral-400 text-sm" />
                        <input
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleExtract();
                          }}
                          placeholder="Tempel tautan video, musik, atau foto"
                          className="w-full min-h-11 pr-24 text-base bg-transparent focus:outline-none text-neutral-950 dark:text-neutral-100 placeholder:text-neutral-400"
                        />
                        {urlInput ? (
                          <button
                            type="button"
                            onClick={() => setUrlInput('')}
                            title="Bersihkan"
                            aria-label="Bersihkan tautan"
                            className="absolute right-1 w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handlePasteClipboard}
                            className="absolute right-1 h-9 px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-accent-soft rounded-lg transition-colors cursor-pointer"
                          >
                            <i className="fa-regular fa-paste mr-1.5" />
                            Tempel
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExtract()}
                        disabled={extracting}
                        className="min-h-11 px-6 text-sm font-bold bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {extracting ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin mr-2" />
                            Membaca tautan
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-arrow-down mr-2" />
                            Cari media
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                        Coba contoh:
                      </span>
                      {QUICK_TEST_LINKS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setUrlInput(item.url);
                            handleExtract(item.url);
                          }}
                          className="h-8 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-accent-soft hover:border-accent transition-colors cursor-pointer"
                        >
                          <i className={`${item.icon} mr-1.5 opacity-70`} />
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="hover:text-accent transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-clock-rotate-left mr-1.5" />
                        Riwayat unduhan ({historyItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sites')}
                        className="hover:text-accent transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-globe mr-1.5" />
                        {totalExtractors.toLocaleString('id-ID')} situs didukung
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 order-1 lg:order-2">
                  <div className={`viewfinder ${extracting ? 'is-scanning' : ''}`}>
                    <div className="viewfinder-frame aspect-[2/1] sm:aspect-[16/9] lg:aspect-[4/5] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white">
                      {!thumbError ? (
                        <img
                          src="/thumbnail.jpg"
                          alt="Ilustrasi Tina, maskot Tina Downloader, sedang melambaikan tangan"
                          referrerPolicy="no-referrer"
                          onError={() => setThumbError(true)}
                          className="w-full h-full object-cover object-[55%_50%]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
                          <i className="fa-solid fa-arrow-down text-2xl text-neutral-400" />
                        </div>
                      )}
                      <span className="vf-scan" aria-hidden="true" />
                    </div>
                    <span className="vf-corner vf-tl" aria-hidden="true" />
                    <span className="vf-corner vf-tr" aria-hidden="true" />
                    <span className="vf-corner vf-bl" aria-hidden="true" />
                    <span className="vf-corner vf-br" aria-hidden="true" />
                  </div>
                </div>
              </section>

              {/* 3. MEDIA RESULT STUDIO (V10 PLAYER + RESOLUTIONS + CLEAN USER INFO) */}
              <AnimatePresence mode="wait">
                {extracting ? (
                  /* Monochrome Loading Skeleton */
                  <motion.section
                    key="result-skeleton"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    aria-busy="true"
                    className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden"
                  >
                    <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs font-medium text-neutral-500">
                      <span>
                        <i className="fa-solid fa-circle-notch fa-spin mr-2 text-neutral-900 dark:text-white" />
                        Menyiapkan pemutar media dan daftar resolusi unduhan...
                      </span>
                      <span>Mohon tunggu</span>
                    </div>

                    <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-7 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-32 rounded-lg skeleton-shimmer" />
                          <div className="h-8 w-32 rounded-lg skeleton-shimmer" />
                        </div>
                        <div className="w-full aspect-video rounded-xl skeleton-shimmer" />
                        <div className="h-12 w-full rounded-xl skeleton-shimmer" />
                      </div>

                      <div className="lg:col-span-5 space-y-4">
                        <div className="h-4 w-48 rounded skeleton-shimmer" />
                        <div className="space-y-2">
                          <div className="h-6 w-full rounded skeleton-shimmer" />
                          <div className="h-6 w-3/4 rounded skeleton-shimmer" />
                        </div>
                        <div className="h-4 w-40 rounded skeleton-shimmer" />
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="h-14 rounded-lg skeleton-shimmer" />
                          <div className="h-14 rounded-lg skeleton-shimmer" />
                        </div>
                        <div className="space-y-2 pt-2">
                          <div className="h-10 w-full rounded-lg skeleton-shimmer" />
                          <div className="h-10 w-full rounded-lg skeleton-shimmer" />
                        </div>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6 space-y-3">
                      {[1, 2, 3, 4].map((r) => (
                        <div key={r} className="h-10 w-full rounded-lg skeleton-shimmer" />
                      ))}
                    </div>
                  </motion.section>
                ) : (
                  mediaResult && (
                    <motion.section
                      key="result-sheet"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden"
                    >
                      {/* Top Bar of Result Sheet: Platform & Clean Sub-Tab Switcher */}
                      <div className="px-5 py-3 bg-paper dark:bg-paper border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className="font-bold uppercase text-neutral-950 dark:text-white">
                            {mediaResult.platform}
                          </span>
                          <span>·</span>
                          <span>{mediaResult.author}</span>
                          {mediaResult.duration && (
                            <>
                              <span>·</span>
                              <span>{mediaResult.duration}</span>
                            </>
                          )}
                        </div>

                        {/* Sub-Tabs: Pilihan Unduhan vs Informasi Media (Zero Coding Jargon) */}
                        <div className="flex items-center gap-1 p-0.5 bg-neutral-200/70 dark:bg-neutral-900 rounded-lg border border-neutral-300/60 dark:border-neutral-800">
                          <button
                            type="button"
                            onClick={() => setResultSubTab('streams')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                              resultSubTab === 'streams'
                                ? 'bg-white text-neutral-950 shadow-2xs dark:bg-neutral-100 dark:text-neutral-950'
                                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                            }`}
                          >
                            <i className="fa-solid fa-download mr-1.5" />
                            Pilihan Unduhan ({mediaResult.downloads?.length || 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => setResultSubTab('info')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                              resultSubTab === 'info'
                                ? 'bg-white text-neutral-950 shadow-2xs dark:bg-neutral-100 dark:text-neutral-950'
                                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                            }`}
                          >
                            <i className="fa-solid fa-circle-info mr-1.5" />
                            Informasi Media
                          </button>
                        </div>
                      </div>

                      {/* Top Studio Split: V10 Player / Carousel Stage (7 Cols) + Summary & Quick Download (5 Cols) */}
                      <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left 7 Columns: V10 Media Player / Photo Carousel / V10 Audio Deck */}
                        <div className="lg:col-span-7 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                              {carouselImages.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewMode('carousel')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                    previewMode === 'carousel'
                                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                  }`}
                                >
                                  <i className="fa-regular fa-images mr-1.5" />
                                  Galeri Foto ({carouselImages.length})
                                </button>
                              )}
                              {videoStreams.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewMode('video')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                    previewMode === 'video'
                                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                  }`}
                                >
                                  <i className="fa-solid fa-play mr-1.5" />
                                  V10 Video Player
                                </button>
                              )}
                              {audioStreams.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewMode('audio')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                    previewMode === 'audio'
                                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                  }`}
                                >
                                  <i className="fa-solid fa-headphones mr-1.5" />
                                  V10 Audio Player
                                </button>
                              )}
                              {mediaResult.thumbnail && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewMode('cover')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                    previewMode === 'cover'
                                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                  }`}
                                >
                                  <i className="fa-regular fa-image mr-1.5" />
                                  Sampul
                                </button>
                              )}
                            </div>
                          </div>

                          {/* STAGE A: CUSTOM V10 VIDEO PLAYER */}
                          {previewMode === 'video' && activeVideoStream && (
                            <V10VideoPlayer
                              activeStream={activeVideoStream}
                              videoStreams={videoStreams}
                              poster={mediaResult.thumbnail}
                              title={mediaResult.title}
                              webpageUrl={mediaResult.webpageUrl}
                              onSelectStream={(s) => setActiveVideoStream(s)}
                              onDownload={(s) => handleDownloadStream(s)}
                              buildStreamUrl={buildProxyStreamUrl}
                            />
                          )}

                          {/* STAGE B: PHOTO CAROUSEL */}
                          {previewMode === 'carousel' && carouselImages.length > 0 && (
                            <div className="space-y-3">
                              <div className="relative w-full aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                                <AnimatePresence mode="wait">
                                  <motion.img
                                    key={`slide_${carouselIndex}`}
                                    initial={{ opacity: 0, x: 14 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -14 }}
                                    transition={{ duration: 0.16 }}
                                    src={buildProxyStreamUrl(carouselImages[carouselIndex])}
                                    alt={`${mediaResult.title} - Slide ${carouselIndex + 1}`}
                                    referrerPolicy="no-referrer"
                                    onClick={() => setLightboxOpen(true)}
                                    className="w-full h-full object-contain cursor-zoom-in select-none"
                                  />
                                </AnimatePresence>

                                {carouselImages.length > 1 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCarouselIndex((prev) =>
                                          prev === 0 ? carouselImages.length - 1 : prev - 1
                                        )
                                      }
                                      aria-label="Slide Sebelumnya"
                                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-black/80 hover:bg-black text-white border border-white/15 flex items-center justify-center cursor-pointer"
                                    >
                                      <i className="fa-solid fa-chevron-left text-xs" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCarouselIndex((prev) =>
                                          prev === carouselImages.length - 1 ? 0 : prev + 1
                                        )
                                      }
                                      aria-label="Slide Berikutnya"
                                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-black/80 hover:bg-black text-white border border-white/15 flex items-center justify-center cursor-pointer"
                                    >
                                      <i className="fa-solid fa-chevron-right text-xs" />
                                    </button>
                                  </>
                                )}

                                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 border border-white/15 text-white text-[11px] font-semibold">
                                  Foto {carouselIndex + 1} / {carouselImages.length}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setLightboxOpen(true)}
                                  className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-black/75 hover:bg-black border border-white/15 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                                >
                                  <i className="fa-solid fa-expand text-[11px]" />
                                  Layar Penuh
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                  {carouselImages.map((imgUrl, idx) => {
                                    const active = idx === carouselIndex;
                                    return (
                                      <button
                                        key={`thumb_${idx}`}
                                        type="button"
                                        onClick={() => setCarouselIndex(idx)}
                                        className={`relative w-12 h-12 rounded-md overflow-hidden shrink-0 border transition-all cursor-pointer ${
                                          active
                                            ? 'border-neutral-950 dark:border-white ring-1 ring-neutral-950 dark:ring-white'
                                            : 'border-neutral-200 dark:border-neutral-800 opacity-55 hover:opacity-100'
                                        }`}
                                      >
                                        <img
                                          src={buildProxyStreamUrl(imgUrl)}
                                          alt={`Slide ${idx + 1}`}
                                          loading="lazy"
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDownloadSlideImage(
                                        carouselImages[carouselIndex],
                                        carouselIndex
                                      )
                                    }
                                    className="px-3 py-1.5 text-xs font-bold bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg cursor-pointer"
                                  >
                                    <i className="fa-solid fa-download mr-1.5" />
                                    Unduh Foto #{carouselIndex + 1}
                                  </button>
                                  {carouselImages.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={handleCompilePdf}
                                      disabled={compilingPdf}
                                      className="px-3 py-1.5 text-xs font-bold border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer"
                                    >
                                      <i
                                        className={`fa-solid ${
                                          compilingPdf ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'
                                        } mr-1.5`}
                                      />
                                      Simpan PDF ({carouselImages.length})
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* STAGE C: CUSTOM V10 AUDIO PLAYER */}
                          {previewMode === 'audio' && activeAudioStream && (
                            <V10AudioPlayer
                              stream={activeAudioStream}
                              title={mediaResult.title}
                              author={mediaResult.author}
                              thumbnail={mediaResult.thumbnail}
                              webpageUrl={mediaResult.webpageUrl}
                              durationHint={mediaResult.duration}
                              fallbackStreamUrl={
                                audioStreams.find((s) => s.url.includes('piped.private.coffee'))?.url ||
                                videoStreams.find((s) => s.url.includes('piped.private.coffee'))?.url
                              }
                              onDownload={(s) => handleDownloadStream(s)}
                              buildStreamUrl={buildProxyStreamUrl}
                            />
                          )}

                          {/* STAGE D: THUMBNAIL COVER */}
                          {previewMode === 'cover' && (
                            <div className="w-full aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                              {mediaResult.thumbnail ? (
                                <img
                                  src={mediaResult.thumbnail}
                                  alt={mediaResult.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <i className="fa-solid fa-film text-2xl text-neutral-500" />
                              )}
                            </div>
                          )}

                          {/* Compact V10 Audio Deck below Video / Carousel */}
                          {previewMode !== 'audio' && activeAudioStream && (
                            <V10AudioPlayer
                              stream={activeAudioStream}
                              title={mediaResult.title}
                              author={mediaResult.author}
                              webpageUrl={mediaResult.webpageUrl}
                              durationHint={mediaResult.duration}
                              fallbackStreamUrl={
                                audioStreams.find((s) => s.url.includes('piped.private.coffee'))?.url ||
                                videoStreams.find((s) => s.url.includes('piped.private.coffee'))?.url
                              }
                              compact
                              onDownload={(s) => handleDownloadStream(s)}
                              buildStreamUrl={buildProxyStreamUrl}
                            />
                          )}
                        </div>

                        {/* Right 5 Columns: User-Friendly Summary & Quick Download Buttons */}
                        <div className="lg:col-span-5 space-y-4">
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                              RINGKASAN MEDIA
                            </div>
                            <h2 className="text-base sm:text-lg font-extrabold text-neutral-950 dark:text-white leading-snug">
                              {mediaResult.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 pt-0.5">
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                {mediaResult.author}
                              </span>
                              <span>·</span>
                              <a
                                href={mediaResult.webpageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-neutral-950 dark:hover:text-white underline underline-offset-4"
                              >
                                Buka Sumber Asli
                              </a>
                            </div>
                          </div>

                          {/* Clean 2x2 User Info Grid (No Coding Terms) */}
                          <div className="grid grid-cols-2 divide-x divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-paper dark:bg-paper">
                            <div className="p-3">
                              <div className="text-[10px] font-semibold uppercase text-neutral-400">
                                KUALITAS TERBAIK
                              </div>
                              <div className="text-xs font-bold text-neutral-950 dark:text-white mt-0.5 truncate">
                                {mediaResult.resolution || 'Full HD Original'}
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="text-[10px] font-semibold uppercase text-neutral-400">
                                DURASI MEDIA
                              </div>
                              <div className="text-xs font-bold text-neutral-950 dark:text-white mt-0.5 truncate">
                                {mediaResult.duration || 'Siap Unduh'}
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="text-[10px] font-semibold uppercase text-neutral-400">
                                TAYANGAN & SUKA
                              </div>
                              <div className="text-xs font-bold text-neutral-950 dark:text-white mt-0.5 truncate">
                                {typeof mediaResult.viewCount === 'number'
                                  ? `${mediaResult.viewCount.toLocaleString('id-ID')} tayangan`
                                  : '-'}
                                {typeof mediaResult.likeCount === 'number'
                                  ? ` · ${mediaResult.likeCount.toLocaleString('id-ID')}`
                                  : ''}
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="text-[10px] font-semibold uppercase text-neutral-400">
                                TANGGAL & UKURAN
                              </div>
                              <div className="text-xs font-bold text-neutral-950 dark:text-white mt-0.5 truncate">
                                {[mediaResult.uploadDate, mediaResult.filesizeApprox]
                                  .filter(Boolean)
                                  .join(' · ') || 'Tersedia'}
                              </div>
                            </div>
                          </div>

                          {/* Primary Direct Download Buttons */}
                          <div className="space-y-2 pt-1">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                              UNDUH CEPAT
                            </div>

                            {videoStreams[0] && (
                              <button
                                type="button"
                                onClick={() => handleDownloadStream(videoStreams[0])}
                                className="w-full py-2.5 px-4 rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span className="truncate">
                                  <i className="fa-solid fa-video mr-2" />
                                  {videoStreams[0].quality}
                                </span>
                                <span className="ml-2 shrink-0">
                                  {videoStreams[0].filesizeFormatted || 'MP4'}{' '}
                                  <i className="fa-solid fa-arrow-down ml-1" />
                                </span>
                              </button>
                            )}

                            {audioStreams[0] && (
                              <button
                                type="button"
                                onClick={() => handleDownloadStream(audioStreams[0])}
                                className="w-full py-2.5 px-4 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-950 dark:text-white font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span className="truncate">
                                  <i className="fa-solid fa-music mr-2" />
                                  {audioStreams[0].quality}
                                </span>
                                <span className="ml-2 shrink-0">
                                  {audioStreams[0].ext?.toUpperCase() || 'MP3'}{' '}
                                  <i className="fa-solid fa-arrow-down ml-1" />
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* =========================================================
                          SUB-TAB 1: PILIHAN UNDUHAN TABLE
                         ========================================================= */}
                      {resultSubTab === 'streams' && (
                        <div className="p-5 sm:p-6 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Segmented Filter Controls */}
                            <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                              <button
                                type="button"
                                onClick={() => setStreamFilter('all')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                  streamFilter === 'all'
                                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                }`}
                              >
                                Semua ({mediaResult.downloads?.length || 0})
                              </button>
                              {videoStreams.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setStreamFilter('video')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                    streamFilter === 'video'
                                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                  }`}
                                >
                                  Video ({videoStreams.length})
                                </button>
                              )}
                              {audioStreams.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setStreamFilter('audio')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                    streamFilter === 'audio'
                                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                  }`}
                                >
                                  Musik / Audio ({audioStreams.length})
                                </button>
                              )}
                              {imageStreams.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setStreamFilter('image')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                                    streamFilter === 'image'
                                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                                  }`}
                                >
                                  Foto ({imageStreams.length})
                                </button>
                              )}
                            </div>

                            {carouselImages.length > 1 && (
                              <button
                                type="button"
                                onClick={handleCompilePdf}
                                disabled={compilingPdf}
                                className="px-3.5 py-1.5 text-xs font-bold bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg cursor-pointer"
                              >
                                <i
                                  className={`fa-solid ${
                                    compilingPdf ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'
                                  } mr-1.5`}
                                />
                                {compilingPdf
                                  ? 'Membuat PDF...'
                                  : `Gabung ${carouselImages.length} Foto ke PDF`}
                              </button>
                            )}
                          </div>

                          <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-paper dark:bg-paper text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                                  <th className="py-2.5 px-4">Pilihan Kualitas</th>
                                  <th className="py-2.5 px-4">Tipe Berkas</th>
                                  <th className="py-2.5 px-4 text-right">Ukuran</th>
                                  <th className="py-2.5 px-4 text-right">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                                {filteredStreams.map((stream, index) => {
                                  const streamKey = stream.id || `${stream.quality}_${index}`;
                                  const isResolving = resolvingStreamId === streamKey;
                                  const isPlayingVideo =
                                    previewMode === 'video' && activeVideoStream?.url === stream.url;
                                  const isPlayingAudio =
                                    previewMode === 'audio' && activeAudioStream?.url === stream.url;

                                  return (
                                    <tr
                                      key={streamKey}
                                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-colors"
                                    >
                                      <td className="py-3 px-4 font-bold text-neutral-950 dark:text-neutral-100">
                                        <i
                                          className={`mr-2.5 text-neutral-400 ${
                                            stream.type === 'audio'
                                              ? 'fa-solid fa-music'
                                              : stream.type === 'image'
                                                ? 'fa-regular fa-image'
                                                : 'fa-solid fa-video'
                                          }`}
                                        />
                                        {stream.quality}
                                      </td>
                                      <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400">
                                        {[
                                          stream.ext?.toUpperCase(),
                                          stream.resolution,
                                          stream.fps ? `${stream.fps} FPS` : null,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ') || 'Kualitas Asli'}
                                      </td>
                                      <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-300">
                                        {stream.filesizeFormatted || 'Siap Unduh'}
                                      </td>
                                      <td className="py-3 px-4 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center gap-1.5">
                                          {stream.type === 'video' && !stream.needsResolve && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveVideoStream(stream);
                                                setPreviewMode('video');
                                              }}
                                              className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                                                isPlayingVideo
                                                  ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                                                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                              }`}
                                            >
                                              <i className="fa-solid fa-play mr-1 text-[10px]" />
                                              {isPlayingVideo ? 'Diputar' : 'Putar'}
                                            </button>
                                          )}

                                          {stream.type === 'audio' && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveAudioStream(stream);
                                                setPreviewMode('audio');
                                              }}
                                              className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                                                isPlayingAudio
                                                  ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                                                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                              }`}
                                            >
                                              <i className="fa-solid fa-headphones mr-1 text-[10px]" />
                                              {isPlayingAudio ? 'Diputar' : 'Dengarkan'}
                                            </button>
                                          )}

                                          {stream.type === 'image' && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const idx = carouselImages.indexOf(stream.url);
                                                if (idx >= 0) setCarouselIndex(idx);
                                                setPreviewMode('carousel');
                                              }}
                                              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                            >
                                              Lihat
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => handleDownloadStream(stream, index)}
                                            disabled={isResolving}
                                            className="px-3 py-1 text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 rounded-md transition-colors cursor-pointer"
                                          >
                                            {isResolving ? (
                                              <>
                                                <i className="fa-solid fa-circle-notch fa-spin mr-1" />
                                                Proses
                                              </>
                                            ) : (
                                              <>
                                                <i className="fa-solid fa-arrow-down mr-1" />
                                                Unduh
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* =========================================================
                          SUB-TAB 2: INFORMASI MEDIA (CLEAN USER-FRIENDLY — NO CODING/JSON)
                         ========================================================= */}
                      {resultSubTab === 'info' && (
                        <div className="p-5 sm:p-6 space-y-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-extrabold text-neutral-950 dark:text-white">
                                Informasi Lengkap Media
                              </h3>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                Ringkasan informasi publik, kreator, serta statistik tayangan media.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleCopySourceLink}
                                className="px-3 py-1.5 text-xs font-semibold border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <i className="fa-regular fa-copy mr-1.5" />
                                Salin Tautan Asli
                              </button>
                              <a
                                href={mediaResult.webpageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 text-xs font-bold bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg transition-colors"
                              >
                                <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" />
                                Buka Postingan
                              </a>
                            </div>
                          </div>

                          {/* 8-Cell Human-Readable Media Summary Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-paper dark:bg-paper">
                            {[
                              ['Platform Asal', mediaResult.platform],
                              ['Kreator / Channel', mediaResult.author],
                              ['Kualitas Terbaik', mediaResult.resolution || 'Full HD Original'],
                              ['Durasi Media', mediaResult.duration || '-'],
                              [
                                'Jumlah Tayangan',
                                typeof mediaResult.viewCount === 'number'
                                  ? `${mediaResult.viewCount.toLocaleString('id-ID')} tayangan`
                                  : '-',
                              ],
                              [
                                'Jumlah Disukai',
                                typeof mediaResult.likeCount === 'number'
                                  ? `${mediaResult.likeCount.toLocaleString('id-ID')} suka`
                                  : '-',
                              ],
                              [
                                'Jumlah Komentar',
                                typeof mediaResult.commentCount === 'number'
                                  ? `${mediaResult.commentCount.toLocaleString('id-ID')} komentar`
                                  : '-',
                              ],
                              ['Tanggal Unggah', mediaResult.uploadDate || '-'],
                            ].map(([label, val]) => (
                              <div key={label} className="p-3.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                  {label}
                                </div>
                                <div className="text-xs font-bold text-neutral-950 dark:text-white mt-1 truncate">
                                  {val}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Clean User-Friendly Media Details Table */}
                          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                            <div className="px-4 py-2.5 bg-paper dark:bg-paper border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold uppercase text-neutral-500">
                              RINCIAN KONTEN
                            </div>
                            <dl className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                              {[
                                ['Judul Lengkap', mediaResult.title],
                                ['Nama Kreator / Pengunggah', mediaResult.author],
                                ['Platform Sumber', mediaResult.platform],
                                [
                                  'Pilihan Unduhan Tersedia',
                                  `${videoStreams.length} Resolusi Video · ${audioStreams.length} Audio Musik · ${carouselImages.length} Foto Galeri`,
                                ],
                                [
                                  'Perkiraan Ukuran Berkas',
                                  mediaResult.filesizeApprox || 'Menyesuaikan pilihan resolusi',
                                ],
                                ['Tautan Sumber Asli', mediaResult.webpageUrl],
                              ].map(([k, v]) => (
                                <div
                                  key={k}
                                  className="px-4 py-3 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 items-baseline"
                                >
                                  <dt className="sm:col-span-4 font-medium text-neutral-500 dark:text-neutral-400">
                                    {k}
                                  </dt>
                                  <dd className="sm:col-span-8 font-semibold text-neutral-950 dark:text-neutral-100 break-all">
                                    {v}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </div>
                      )}
                    </motion.section>
                  )
                )}
              </AnimatePresence>

              {/* 4. Clean Feature Highlights (Single-Elevation Grid, No Coding Jargon) */}
              <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-neutral-950 dark:text-white">
                      Keunggulan Tina Downloader
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Dirancang agar cepat, bersih, dan mudah digunakan oleh siapa saja di berbagai perangkat.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800">
                  {[
                    {
                      code: '01 / V10 MEDIA PLAYER',
                      title: 'V10 Video & Audio Player',
                      desc: 'Tonton video atau dengarkan musik langsung sebelum mengunduh dengan pemilih resolusi instan, kontrol kecepatan putar, dan Picture-in-Picture.',
                    },
                    {
                      code: '02 / GALERI FOTO & PDF',
                      title: 'Photo Carousel & Ekspor PDF',
                      desc: 'Lihat galeri foto multi-slide secara interaktif, unduh per foto kualitas asli (.JPG), atau gabungkan seluruh slide menjadi dokumen PDF.',
                    },
                    {
                      code: '03 / 1.600+ SITUS GLOBAL',
                      title: 'Unduhan Tanpa Watermark',
                      desc: 'Mendukung unduhan video HD tanpa watermark dari TikTok, Instagram, YouTube, X, Spotify, Pixiv, dan ribuan situs lainnya.',
                    },
                  ].map((item) => (
                    <div key={item.code} className="p-5 sm:p-6 space-y-2">
                      <div className="text-[11px] font-mono text-neutral-400">{item.code}</div>
                      <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Interactive FAQ Section */}
              <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base sm:text-lg font-extrabold text-neutral-950 dark:text-white">
                    Pertanyaan Umum (FAQ)
                  </h2>
                </div>

                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {FAQ_ITEMS.map((faq, idx) => {
                    const isOpen = openFaqIndex === idx;
                    return (
                      <div key={faq.question} className="py-3.5 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                          className="w-full flex items-center justify-between gap-4 text-left py-1 cursor-pointer"
                        >
                          <span className="text-xs sm:text-sm font-bold text-neutral-950 dark:text-white">
                            {faq.question}
                          </span>
                          <i
                            className={`fa-solid fa-chevron-down text-xs text-neutral-400 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-neutral-950 dark:text-white' : ''
                            }`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.16 }}
                              className="overflow-hidden"
                            >
                              <p className="pt-2 pb-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                {faq.answer}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </section>
            </motion.div>
          )}

          {/* =========================================================
              VIEW 2: RIWAYAT UNDUHAN (REMADE ARCHIVE & PLAYBACK STUDIO)
             ========================================================= */}
          {activeTab === 'history' && (
            <motion.div
              key="view-history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              {/* 1. Archive Header & 4-Column Summary Ledger */}
              <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                      <span className="w-2 h-2 rounded-xs bg-neutral-950 dark:bg-white inline-block" />
                      <span>ARCHIVE & PLAYBACK LEDGER</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                      Riwayat Unduhan & Pustaka Media
                    </h1>
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
                      Seluruh tautan video, lagu penuh, dan galeri foto yang pernah Anda ekstrak tersimpan otomatis. Putar ulang di V10 Media Player atau unduh kembali kapan saja tanpa antre.
                    </p>
                  </div>

                  {historyItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportHistoryJson}
                        className="px-3.5 py-2 text-xs font-bold border border-neutral-300 dark:border-neutral-700 bg-paper dark:bg-paper hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-file-export mr-1.5" />
                        Ekspor JSON
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllHistory}
                        className="px-3.5 py-2 text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can mr-1.5" />
                        Bersihkan Semua
                      </button>
                    </div>
                  )}
                </div>

                {/* 4-Column Metrics Ledger */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-neutral-200 dark:divide-neutral-800 bg-paper dark:bg-paper">
                  <div className="p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      TOTAL RIWAYAT
                    </div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-neutral-950 dark:text-white mt-0.5">
                      {historyStats.total}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      VIDEO & REELS
                    </div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-neutral-950 dark:text-white mt-0.5">
                      {historyStats.video}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      MUSIK & AUDIO MP3
                    </div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-neutral-950 dark:text-white mt-0.5">
                      {historyStats.audio}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      GALERI FOTO & SLIDE
                    </div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-neutral-950 dark:text-white mt-0.5">
                      {historyStats.image}
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Filter, Search & Sort Controls */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  {(
                    [
                      ['all', `Semua (${historyStats.total})`, 'fa-solid fa-layer-group'],
                      ['video', `Video (${historyStats.video})`, 'fa-solid fa-video'],
                      ['audio', `Musik (${historyStats.audio})`, 'fa-solid fa-music'],
                      ['image', `Foto (${historyStats.image})`, 'fa-regular fa-images'],
                    ] as ['all' | 'video' | 'audio' | 'image', string, string][]
                  ).map(([id, label, icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHistoryCategoryFilter(id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        historyCategoryFilter === id
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                      }`}
                    >
                      <i className={`${icon} mr-1.5 text-[11px]`} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-1 items-center gap-2">
                  <div className="relative flex-1">
                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Cari judul media, kreator, platform, atau URL..."
                      className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                    />
                    {historySearch && (
                      <button
                        type="button"
                        onClick={() => setHistorySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    )}
                  </div>

                  <select
                    value={historySort}
                    onChange={(e) => setHistorySort(e.target.value as 'newest' | 'oldest' | 'title')}
                    aria-label="Urutkan Riwayat"
                    className="px-3 py-2 text-xs font-bold bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer"
                  >
                    <option value="newest">Terbaru</option>
                    <option value="oldest">Terlama</option>
                    <option value="title">Judul A–Z</option>
                  </select>
                </div>
              </div>

              {/* 3. History Items Table / Empty State */}
              {filteredHistory.length === 0 ? (
                <div className="py-16 px-4 text-center bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 mx-auto flex items-center justify-center text-neutral-400">
                    <i className="fa-solid fa-clock-rotate-left text-lg" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-neutral-950 dark:text-white">
                      {historyItems.length === 0
                        ? 'Belum Ada Riwayat Unduhan'
                        : 'Tidak Ada Media yang Sesuai Filter'}
                    </p>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto">
                      {historyItems.length === 0
                        ? 'Setiap tautan video, lagu Spotify/SoundCloud, atau galeri foto yang Anda ekstrak akan tersimpan otomatis di sini.'
                        : 'Coba ubah kata kunci pencarian atau pilih kategori "Semua" untuk melihat seluruh arsip.'}
                    </p>
                  </div>
                  <div className="pt-1 flex items-center justify-center gap-2">
                    {historyItems.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHistorySearch('');
                          setHistoryCategoryFilter('all');
                        }}
                        className="px-4 py-2 text-xs font-bold bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg cursor-pointer"
                      >
                        Reset Filter Pencarian
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('downloader')}
                        className="px-4 py-2 text-xs font-bold bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg cursor-pointer"
                      >
                        <i className="fa-solid fa-arrow-down mr-1.5" />
                        Mulai Ekstrak Media
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-paper dark:bg-paper text-[11px] font-mono uppercase text-neutral-500">
                          <th className="py-3 px-4">Media & Kreator</th>
                          <th className="py-3 px-4">Platform · Tipe</th>
                          <th className="py-3 px-4">Kualitas · Durasi</th>
                          <th className="py-3 px-4 text-right">Waktu Simpan</th>
                          <th className="py-3 px-4 text-right">Aksi Cepat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                        {filteredHistory.map((item) => {
                          const itemType = classifyHistoryItemType(item);
                          const isCopied = copiedHistoryId === item.id;
                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                            >
                              <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shrink-0 flex items-center justify-center">
                                    {item.thumbnail ? (
                                      <img
                                        src={buildProxyStreamUrl(item.thumbnail)}
                                        alt={item.title}
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <i
                                        className={`fa-solid ${
                                          itemType === 'audio'
                                            ? 'fa-music'
                                            : itemType === 'image'
                                              ? 'fa-images'
                                              : 'fa-film'
                                        } text-neutral-400 text-xs`}
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-neutral-950 dark:text-neutral-100 truncate">
                                      {item.title}
                                    </div>
                                    <div className="text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                      {item.author}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] font-bold uppercase text-neutral-800 dark:text-neutral-200">
                                  <i
                                    className={`fa-solid ${
                                      itemType === 'audio'
                                        ? 'fa-headphones'
                                        : itemType === 'image'
                                          ? 'fa-image'
                                          : 'fa-video'
                                    } text-[10px] text-neutral-500`}
                                  />
                                  <span>{item.platform}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono tabular-nums text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                                <span className="font-bold text-neutral-900 dark:text-white">
                                  {item.quality || 'Original HD'}
                                </span>
                                {item.duration && item.duration !== '-' && (
                                  <span className="text-neutral-400"> · {item.duration}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-500 whitespace-nowrap">
                                {new Date(item.createdAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUrlInput(item.url);
                                      setActiveTab('downloader');
                                      if (item.metadata) {
                                        setMediaResult(item.metadata);
                                      } else {
                                        handleExtract(item.url);
                                      }
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <i className="fa-solid fa-play mr-1.5 text-[10px]" />
                                    Putar di Studio
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyHistoryUrl(item.id, item.url)}
                                    title="Salin Tautan Asli"
                                    className="px-2.5 py-1.5 text-xs font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <i className={`fa-solid ${isCopied ? 'fa-check' : 'fa-link'}`} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteHistoryItem(item.id)}
                                    className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                    title="Hapus dari Riwayat"
                                  >
                                    <i className="fa-solid fa-trash text-xs" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* =========================================================
              VIEW 3: DIREKTORI SITUS
             ========================================================= */}
          {activeTab === 'sites' && (
            <motion.div
              key="view-sites"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-neutral-950 dark:text-white tabular-nums">
                    Daftar Situs Didukung ({supportedSites.length.toLocaleString('id-ID')})
                  </h1>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Direktori lengkap seluruh platform yang dapat diunduh melalui Tina Downloader.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  {SITE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
                <input
                  type="text"
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                  placeholder="Cari nama platform (contoh: tiktok, youtube, instagram, spotify, pixiv, bilibili)..."
                  className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                />
                {siteSearch && (
                  <button
                    type="button"
                    onClick={() => setSiteSearch('')}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                {loadingSites && allSites.length === 0 ? (
                  <div className="p-12 text-center text-xs text-neutral-500">
                    <i className="fa-solid fa-circle-notch fa-spin mr-2" />
                    Memuat daftar situs...
                  </div>
                ) : supportedSites.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <i className="fa-solid fa-globe text-xl text-neutral-400" />
                    <div className="text-sm font-bold text-neutral-950 dark:text-white">
                      Platform tidak ditemukan untuk &ldquo;{siteSearch}&rdquo;
                    </div>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto">
                      Meski tidak tertulis di pencarian, Anda tetap dapat menempelkan tautan situs tersebut di Beranda Unduhan karena mesin ekstraktor generik mendukung ribuan domain lainnya.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSiteSearch('');
                        setSelectedCategory('Semua');
                      }}
                      className="px-3.5 py-2 text-xs font-bold bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg cursor-pointer"
                    >
                      Reset Filter Situs
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[620px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-paper dark:bg-paper border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold uppercase text-neutral-500">
                          <tr>
                            <th className="py-3 px-4 w-16">#</th>
                            <th className="py-3 px-4">Platform / Ekstraktor</th>
                            <th className="py-3 px-4">Kategori</th>
                            <th className="py-3 px-4">Dukungan Unduhan</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                          {supportedSites.slice(0, sitesDisplayLimit).map((site, idx) => (
                            <tr
                              key={`${site.name}_${idx}`}
                              className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                            >
                              <td className="py-2.5 px-4 text-neutral-400 font-mono tabular-nums">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-4 font-bold text-neutral-950 dark:text-neutral-100">
                                {site.name}
                              </td>
                              <td className="py-2.5 px-4 text-neutral-500">{site.category}</td>
                              <td className="py-2.5 px-4 text-neutral-600 dark:text-neutral-300">
                                {site.description}
                              </td>
                              <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('downloader');
                                    setStatusNotice(
                                      `Silakan tempel tautan dari ${site.name} pada kolom unduhan.`
                                    );
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold border border-neutral-300 dark:border-neutral-700 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 transition-colors cursor-pointer"
                                >
                                  Unduh
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {supportedSites.length > sitesDisplayLimit && (
                      <div className="px-4 py-3 bg-paper dark:bg-paper border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="text-neutral-500 tabular-nums">
                          Menampilkan {sitesDisplayLimit.toLocaleString('id-ID')} dari{' '}
                          {supportedSites.length.toLocaleString('id-ID')} situs didukung
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSitesDisplayLimit((prev) => prev + 300)}
                            className="px-3 py-1.5 font-bold border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                          >
                            +300 Lagi
                          </button>
                          <button
                            type="button"
                            onClick={() => setSitesDisplayLimit(supportedSites.length)}
                            className="px-3 py-1.5 font-bold bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg cursor-pointer"
                          >
                            Tampilkan Semua ({supportedSites.length.toLocaleString('id-ID')})
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* =========================================================
              VIEW 4: DOKUMENTASI API (DEDICATED CODING & JSON METADATA PAGE)
             ========================================================= */}
          {activeTab === 'api-docs' && (
            <ApiDocsPage
              deviceId={deviceId}
              totalExtractors={totalExtractors}
              lastExtractedMedia={mediaResult}
            />
          )}

          {/* =========================================================
              VIEW 5: TENTANG & FAQ
             ========================================================= */}
          {activeTab === 'about' && (
            <motion.div
              key="view-about"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
                  <h1 className="text-xl font-bold text-neutral-950 dark:text-white">
                    Tentang Tina Downloader
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-3xl">
                    <strong>Tina Downloader</strong> adalah aplikasi web pengunduh media lintas platform yang dibangun oleh <strong>Nimzz</strong>. Dirancang dengan tampilan monokrom yang bersih untuk memudahkan pengguna mengunduh video, musik, serta galeri foto dari lebih dari {totalExtractors.toLocaleString('id-ID')}+ situs, sekaligus menyediakan halaman <strong>Dokumentasi API</strong> terpisah bagi pengembang.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800">
                  {[
                    ['1.600+ Platform', 'Mendukung situs video sosial, musik, cloud, komik, hingga portal berita global.'],
                    ['V10 Media Player', 'Pemutar video dan audio kustom dengan pemilih resolusi, kontrol kecepatan, dan PiP.'],
                    ['Dokumentasi API Terpisah', 'Menyediakan endpoint REST API dan JSON Inspector pada halaman khusus pengembang.'],
                  ].map(([title, desc]) => (
                    <div key={title} className="p-5 space-y-1.5">
                      <div className="text-sm font-bold text-neutral-950 dark:text-white">
                        {title}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-extrabold text-neutral-950 dark:text-white">
                  Pertanyaan yang Sering Diajukan (FAQ)
                </h2>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {FAQ_ITEMS.map((faq, idx) => {
                    const isOpen = openFaqIndex === idx;
                    return (
                      <div key={faq.question} className="py-3.5 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                          className="w-full flex items-center justify-between gap-4 text-left py-1 cursor-pointer"
                        >
                          <span className="text-xs sm:text-sm font-bold text-neutral-950 dark:text-white">
                            {faq.question}
                          </span>
                          <i
                            className={`fa-solid fa-chevron-down text-xs text-neutral-400 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-neutral-950 dark:text-white' : ''
                            }`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.16 }}
                              className="overflow-hidden"
                            >
                              <p className="pt-2 pb-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                {faq.answer}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* =========================================================
              VIEW 6: PROFILE DEVELOPER — NIMZZ (REMADE EDITORIAL STUDIO)
             ========================================================= */}
          {activeTab === 'developer' && (
            <DeveloperPage
              socialAccounts={NIMZZ_SOCIAL_ACCOUNTS}
              totalExtractors={totalExtractors}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onQuickTestUrl={(testUrl) => {
                setUrlInput(testUrl);
                setActiveTab('downloader');
                handleExtract(testUrl);
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Fullscreen Lightbox Modal for Carousel Images */}
      <AnimatePresence>
        {lightboxOpen && carouselImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative max-w-5xl w-full max-h-[84vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={buildProxyStreamUrl(carouselImages[carouselIndex])}
                alt={`Slide ${carouselIndex + 1}`}
                className="max-w-full max-h-[82vh] object-contain rounded-lg"
              />

              {carouselImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setCarouselIndex((prev) =>
                        prev === 0 ? carouselImages.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCarouselIndex((prev) =>
                        prev === carouselImages.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </>
              )}
            </div>

            <div
              className="mt-4 flex items-center gap-3 text-white text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-semibold">
                Foto {carouselIndex + 1} / {carouselImages.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleDownloadSlideImage(carouselImages[carouselIndex], carouselIndex)
                }
                className="px-3.5 py-2 rounded-lg bg-white text-neutral-950 font-bold cursor-pointer"
              >
                <i className="fa-solid fa-download mr-1.5" />
                Unduh Foto Ini
              </button>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monochrome SaaS Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-6 px-4 sm:px-6 text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={logoSrc}
              alt="Tina Downloader"
              className="w-5 h-5 rounded object-cover border border-neutral-300 dark:border-neutral-700"
            />
            <strong className="text-neutral-950 dark:text-white">Tina Downloader</strong>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => setActiveTab('api-docs')}
              className="hover:text-neutral-950 dark:hover:text-white cursor-pointer"
            >
              Dokumentasi API
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className="hover:text-neutral-950 dark:hover:text-white cursor-pointer"
            >
              Tentang & FAQ
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => setActiveTab('developer')}
              className="hover:text-neutral-950 dark:hover:text-white cursor-pointer"
            >
              Developer Nimzz
            </button>
          </div>

          <div className="flex items-center gap-5">
            {NIMZZ_SOCIAL_ACCOUNTS.map((acc) => (
              <a
                key={acc.platform}
                href={acc.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={acc.platform}
                className="hover:text-neutral-950 dark:hover:text-white transition-colors"
              >
                <i className={`${acc.icon} text-sm`} />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
