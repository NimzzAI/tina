import React, { useState } from 'react';
import { motion } from 'motion/react';

export interface SocialAccount {
  platform: string;
  handle: string;
  description: string;
  icon: string;
  url: string;
}

interface DeveloperPageProps {
  socialAccounts: SocialAccount[];
  totalExtractors: number;
  onNavigateTab: (tab: 'downloader' | 'history' | 'sites' | 'api-docs' | 'about' | 'developer') => void;
  onQuickTestUrl: (url: string) => void;
}

type ModuleCategory = 'all' | 'backend' | 'frontend' | 'security';

interface ArchitectureModule {
  id: string;
  index: string;
  title: string;
  category: ModuleCategory;
  categoryLabel: string;
  stack: string;
  summary: string;
  highlights: string[];
  actionLabel: string;
  targetTab: 'downloader' | 'history' | 'sites' | 'api-docs' | 'about';
}

const ARCHITECTURE_MODULES: ArchitectureModule[] = [
  {
    id: 'hybrid-core',
    index: '01.',
    title: 'Tina Hybrid Extraction Core',
    category: 'backend',
    categoryLabel: 'Backend & Ekstraktor',
    stack: 'Node.js 22 · Express · TypeScript',
    summary:
      'Mesin orkestrasi utama yang menggabungkan scraper khusus platform (TikTok HD tanpa watermark, Pixiv multi-slide, Instagram, Spotify, X) dengan normalisasi stream otomatis.',
    highlights: [
      'Deteksi otomatis resolusi 1080p/720p, bitrate audio MP3, dan galeri foto',
      'Proxy streaming dengan dukungan penuh HTTP Range untuk seek video instan',
      'Penamaan berkas otomatis (Tina_Judul_Resolusi.mp4/.mp3/.jpg)',
    ],
    actionLabel: 'Coba Ekstraktor Utama',
    targetTab: 'downloader',
  },
  {
    id: 'py-engine',
    index: '02.',
    title: 'Universal Deep Media Engine',
    category: 'backend',
    categoryLabel: 'Backend & Ekstraktor',
    stack: 'Python 3 · yt-dlp · SQLite3',
    summary:
      'Menangani ekstraksi metadata mendalam dari lebih dari 1.600 situs global sekaligus mengelola basis data riwayat unduhan per perangkat secara persisten.',
    highlights: [
      'Mendukung 1.615+ situs video, musik, komik, anime, dan cloud file',
      'Penyimpanan riwayat unduhan lokal berbasis SQLite3 tanpa perlu login',
      'Pemilihan urutan stream cerdas (Video + Audio HD diprioritaskan)',
    ],
    actionLabel: 'Jelajahi 1.615+ Situs',
    targetTab: 'sites',
  },
  {
    id: 'v10-player',
    index: '03.',
    title: 'V10 Custom Video & Audio Deck',
    category: 'frontend',
    categoryLabel: 'Frontend & Media',
    stack: 'React 19 · Tailwind CSS 4 · HTML5 Media API',
    summary:
      'Pemutar media khusus dengan antarmuka monokrom presisi tinggi yang memungkinkan pengguna memeriksa kualitas video, mengganti resolusi tanpa mengulang waktu putar, serta memutar trek MP3.',
    highlights: [
      'Pergantian resolusi mulus dengan pelestarian timestamp pemutaran',
      'Dukungan Picture-in-Picture (PiP), kecepatan putar (0.75x–2x), dan layar penuh',
      'Pemutar audio terintegrasi untuk pratinjau musik & soundtrack',
    ],
    actionLabel: 'Uji V10 Media Player',
    targetTab: 'downloader',
  },
  {
    id: 'pdf-compiler',
    index: '04.',
    title: 'Native Multi-Slide Carousel & PDF 1.4 Builder',
    category: 'frontend',
    categoryLabel: 'Frontend & Media',
    stack: 'Binary Buffer · Native DCTDecode PDF 1.4',
    summary:
      'Penampil galeri foto multi-slide interaktif dengan fitur lightbox layar penuh dan kompilator dokumen PDF murni tanpa ketergantungan pustaka eksternal berat.',
    highlights: [
      'Navigasi thumbnail galeri foto dengan pratinjau zoom layar penuh',
      'Unduh foto individual (.JPG) atau gabungkan hingga 60 slide menjadi satu PDF',
      'Membaca dimensi asli JPEG/PNG untuk tata letak halaman PDF yang presisi',
    ],
    actionLabel: 'Lihat Panduan Galeri & PDF',
    targetTab: 'about',
  },
  {
    id: 'go-guard',
    index: '05.',
    title: 'High-Concurrency Rate & Stream Guard',
    category: 'security',
    categoryLabel: 'Keamanan & API',
    stack: 'Go 1.22 · SHA-256 Device Fingerprint',
    summary:
      'Worker keamanan ringan berbasis Golang yang memvalidasi tanda tangan perangkat dan alamat IP untuk menjaga kestabilan server dari penyalahgunaan otomatis.',
    highlights: [
      'Kuota terukur 15 permintaan per 15 menit dengan proteksi burst',
      'Probing ukuran berkas (Content-Length) secara paralel sebelum pengunduhan',
      'Pencatatan log keamanan terstruktur pada setiap permintaan ekstraksi',
    ],
    actionLabel: 'Periksa Riwayat Perangkat',
    targetTab: 'history',
  },
  {
    id: 'rest-api',
    index: '06.',
    title: 'Open REST API v1 & Live JSON Inspector',
    category: 'security',
    categoryLabel: 'Keamanan & API',
    stack: 'RESTful JSON · cURL · JS · Python · Go',
    summary:
      'Dokumentasi teknis terpisah bagi pengembang yang ingin mengintegrasikan Tina Downloader ke dalam bot Telegram, WhatsApp, Discord, atau skrip otomatisasi.',
    highlights: [
      'Akses terbuka tanpa memerlukan registrasi API Key',
      'Konsol uji coba langsung (Live API Sandbox) untuk inspeksi Raw JSON',
      'Contoh potongan kode siap pakai dalam 4 bahasa pemrograman',
    ],
    actionLabel: 'Buka Dokumentasi API',
    targetTab: 'api-docs',
  },
];

const SHOWCASE_HIGHLIGHTS = [
  {
    title: 'Ekstraksi TikTok 1080p Tanpa Watermark',
    subtitle: 'Video Full HD · Audio MP3 · Slideshow Foto',
    testUrl: 'https://vm.tiktok.com/ZSgCBT3wv/',
  },
  {
    title: 'Video Multi-Resolusi & YouTube Direct Stream',
    subtitle: 'YouTube HD · V10 Video Player · Audio MP3',
    testUrl: 'https://youtu.be/Sgt6yH9UM-c?si=dUP74ef5pdgEShXX',
  },
  {
    title: 'Streaming & Unduhan Lagu Spotify 320kbps',
    subtitle: 'Spotify Track · V10 Audio Deck · Cover Artwork HD',
    testUrl: 'https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ',
  },
  {
    title: 'Galeri Ilustrasi Multi-Slide & Kompilasi PDF',
    subtitle: 'Pixiv Artwork · Pratinjau Lightbox · Ekspor PDF',
    testUrl: 'https://www.pixiv.net/en/artworks/90000005',
  },
];

export const DeveloperPage: React.FC<DeveloperPageProps> = ({
  socialAccounts,
  totalExtractors,
  onNavigateTab,
  onQuickTestUrl,
}) => {
  const [bannerError, setBannerError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [readmeImgError, setReadmeImgError] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<ModuleCategory>('all');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const filteredModules =
    moduleFilter === 'all'
      ? ARCHITECTURE_MODULES
      : ARCHITECTURE_MODULES.filter((m) => m.category === moduleFilter);

  const handleCopyLink = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(key);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <motion.div
      key="view-developer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="space-y-8"
    >
      {/* 1. ARCHITECTURAL DEVELOPER HERO & IDENTITY MONOGRAPH */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {/* Top Visual Banner with Measured Scrim */}
        <div className="relative w-full h-48 sm:h-64 bg-neutral-900 overflow-hidden border-b border-neutral-200 dark:border-neutral-800">
          {!bannerError ? (
            <img
              src="/banner.jpg"
              alt="Sampul Profil Pengembang Nimzz"
              referrerPolicy="no-referrer"
              onError={() => setBannerError(true)}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
              <span className="font-display text-lg font-bold text-neutral-500">
                NIMZZ STUDIO
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyLink('https://github.com/NimzzAi', 'github-top')}
              className="px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black text-white border border-white/15 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <i
                className={`fa-solid ${
                  copiedUrl === 'github-top' ? 'fa-check' : 'fa-share-nodes'
                } mr-1.5`}
              />
              {copiedUrl === 'github-top' ? 'Tautan Profil Tersalin' : 'Bagikan Profil'}
            </button>
          </div>
        </div>

        {/* Identity Split: Avatar + Bio + Primary Actions */}
        <div className="px-5 sm:px-8 pb-7">
          <div className="relative -mt-12 sm:-mt-14 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-4 border-white dark:border-surface bg-neutral-900 overflow-hidden shrink-0 shadow-md">
                {!avatarError ? (
                  <img
                    src="/avatar.jpg"
                    alt="Foto Profil Nimzz"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover object-top scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                    N
                  </div>
                )}
              </div>

              <div className="pb-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
                    Nimzz
                  </h1>
                  <i
                    className="fa-solid fa-circle-check text-accent text-sm"
                    title="Pengembang Resmi Tina Downloader"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  <span>@NimzzAi</span>
                  <span aria-hidden="true">·</span>
                  <span>Full-Stack Engineer & Creator</span>
                  <span aria-hidden="true">·</span>
                  <span>Indonesia</span>
                </div>
              </div>
            </div>

            {/* Primary Contact & Repo Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/NimzzAi"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <i className="fa-brands fa-github mr-1.5" />
                GitHub @NimzzAi
              </a>
              <a
                href="https://whatsapp.com/channel/0029VbBhZWdGJP8HlbGaE63Q"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-xs font-bold bg-accent text-accent-fg hover:bg-accent-hover rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <i className="fa-brands fa-whatsapp mr-1.5" />
                Saluran Resmi
              </a>
              <a
                href="https://t.me/Nimzz4"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <i className="fa-brands fa-telegram mr-1.5" />
                Telegram
              </a>
            </div>
          </div>

          {/* Editorial Bio & Engineering Philosophy */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 items-start">
            <div className="lg:col-span-8 space-y-3">
              <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                Profil Pengembang · Arsitek Sistem Tina Downloader
              </div>
              <p className="text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed max-w-[68ch]">
                <strong>Nimzz</strong> adalah pengembang perangkat lunak dan kreator di balik{' '}
                <strong>Tina Downloader</strong>. Berfokus pada pembangunan aplikasi web utilitas
                yang cepat, bebas iklan mengganggu, dan memadukan antarmuka minimalis dengan
                arsitektur multi-mesin (Node.js, Python, dan Go).
              </p>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-[68ch]">
                Setiap komponen di dalam Tina Downloader—mulai dari ekstraktor video tanpa
                watermark, pemutar media V10, kompilator foto ke PDF, hingga halaman dokumentasi
                REST API—dirancang agar dapat diakses secara gratis dan terbuka bagi pengguna harian
                maupun komunitas pengembang.
              </p>
            </div>

            <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-paper dark:bg-paper space-y-3">
              <div className="text-xs font-bold text-neutral-950 dark:text-white">
                Identitas & Spesifikasi Proyek
              </div>
              <dl className="space-y-2 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-neutral-500 dark:text-neutral-400">Pengembang Utama</dt>
                  <dd className="font-semibold text-neutral-950 dark:text-white">Nimzz (@NimzzAi)</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-neutral-500 dark:text-neutral-400">Fokus Teknis</dt>
                  <dd className="font-semibold text-neutral-950 dark:text-white">
                    Web Tools · Media API · Automation
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-neutral-500 dark:text-neutral-400">Lisensi Layanan</dt>
                  <dd className="font-semibold text-neutral-950 dark:text-white">
                    Publik & Gratis (Tanpa Login)
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-neutral-500 dark:text-neutral-400">Versi Mesin</dt>
                  <dd className="font-mono font-semibold text-neutral-950 dark:text-white tabular-nums">
                    Tina Hybrid Core v10
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Quantitative Proof Ledger */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-neutral-200 dark:divide-neutral-800 border-t border-neutral-200 dark:border-neutral-800 bg-paper dark:bg-paper">
          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Cakupan Ekstraktor
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white mt-1">
              {totalExtractors.toLocaleString('id-ID')}+
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Situs video, audio, galeri & cloud
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Arsitektur Runtime
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white mt-1">
              3 Bahasa
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Node.js 22 · Python 3 · Golang 1.22
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Pemutar & Kompilator
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white mt-1">
              V10 Studio
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Video HD · Audio Deck · PDF 1.4
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Akses Integrasi API
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white mt-1">
              REST API v1
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Terbuka tanpa registrasi API Key
            </div>
          </div>
        </div>
      </section>

      {/* 2. OFFICIAL SOCIAL CHANNELS & COMMUNITY MATRIX */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-950 dark:text-white">
              Saluran Resmi & Komunitas Nimzz
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Ikuti pembaruan ekstraktor, repositori open-source, atau hubungi Nimzz secara langsung.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
            {socialAccounts.length} Saluran Terverifikasi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800">
          {socialAccounts.map((acc, index) => {
            const copyKey = `soc_${acc.platform}`;
            const isCopied = copiedUrl === copyKey;
            return (
              <div
                key={acc.platform}
                className={`p-5 sm:p-6 flex flex-col justify-between gap-4 hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40 transition-colors ${
                  index >= 2 ? 'sm:border-t sm:border-neutral-200 sm:dark:border-neutral-800' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 flex items-center justify-center text-base shrink-0">
                        <i className={acc.icon} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                          {acc.platform}
                        </h3>
                        <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {acc.handle}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    {acc.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={acc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 text-xs font-bold text-center transition-colors whitespace-nowrap"
                  >
                    Buka {acc.platform}
                    <i className="fa-solid fa-arrow-up-right-from-square ml-1.5 text-[10px]" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(acc.url, copyKey)}
                    className="py-2 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <i className={`fa-solid ${isCopied ? 'fa-check' : 'fa-copy'} mr-1.5`} />
                    {isCopied ? 'Tersalin' : 'Salin URL'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. INTERACTIVE ENGINEERING BLUEPRINT & MODULES BUILT BY NIMZZ */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-950 dark:text-white">
              Arsitektur & Modul Rekayasa Tina Downloader
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Rincian komponen sistem yang dirancang dan dikembangkan oleh Nimzz.
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
            {(
              [
                ['all', 'Semua Modul (6)'],
                ['backend', 'Backend & Ekstraktor'],
                ['frontend', 'Frontend & Media'],
                ['security', 'Keamanan & API'],
              ] as [ModuleCategory, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModuleFilter(id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  moduleFilter === id
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800">
          {filteredModules.map((mod, idx) => (
            <div
              key={mod.id}
              className={`p-5 sm:p-6 flex flex-col justify-between gap-5 ${
                idx >= 2 ? 'md:border-t md:border-neutral-200 md:dark:border-neutral-800' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-mono font-bold text-neutral-950 dark:text-white">
                    {mod.index} {mod.categoryLabel}
                  </span>
                  <span className="font-mono text-[11px]">{mod.stack}</span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white">
                  {mod.title}
                </h3>

                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {mod.summary}
                </p>

                <ul className="space-y-1.5 pt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  {mod.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-neutral-400 select-none">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onNavigateTab(mod.targetTab)}
                  className="text-xs font-bold text-accent hover:underline cursor-pointer flex items-center gap-1.5"
                >
                  <span>{mod.actionLabel}</span>
                  <i className="fa-solid fa-arrow-right text-[10px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FEATURED WORK SHOWCASE & DIRECT DEMO LAUNCHER */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left 5 Cols: Visual Artwork from /readme.jpg */}
          <div className="lg:col-span-5 bg-neutral-100 dark:bg-neutral-900 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-800 relative min-h-[220px]">
            {!readmeImgError ? (
              <img
                src="/readme.jpg"
                alt="Ilustrasi Proyek Tina Downloader oleh Nimzz"
                referrerPolicy="no-referrer"
                onError={() => setReadmeImgError(true)}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-8 text-center">
                <span className="font-display text-sm font-bold text-neutral-500">
                  TINA DOWNLOADER BY NIMZZ
                </span>
              </div>
            )}
          </div>

          {/* Right 7 Cols: Interactive Demo Launcher & Feedback */}
          <div className="lg:col-span-7 p-5 sm:p-7 flex flex-col justify-between gap-6">
            <div className="space-y-2">
              <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                Uji Coba Langsung · Karya Unggulan Nimzz
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-neutral-950 dark:text-white">
                Jalankan Demo Ekstraksi Instan
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Pilih salah satu skenario pengujian di bawah ini untuk langsung mencoba kemampuan
                ekstraksi video, galeri foto multi-slide, atau audio MP3 di halaman utama.
              </p>
            </div>

            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-paper dark:bg-paper">
              {SHOWCASE_HIGHLIGHTS.map((demo) => (
                <div
                  key={demo.title}
                  className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-neutral-100/70 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-neutral-950 dark:text-white truncate">
                      {demo.title}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {demo.subtitle}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuickTestUrl(demo.testUrl)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Uji Sekarang
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-neutral-500 dark:text-neutral-400">
              <span>Menemukan situs yang belum didukung atau ingin berdiskusi?</span>
              <a
                href="https://t.me/Nimzz4"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-neutral-950 dark:text-white hover:underline"
              >
                Hubungi @Nimzz4 di Telegram →
              </a>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};
