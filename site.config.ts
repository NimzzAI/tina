const SITE_URL = 'https://tina-downloader.web.id';

type Env = Record<string, string | undefined>;

const baseConfig = {
  url: SITE_URL,
  name: 'Tina Downloader',
  shortName: 'Tina',
  title: 'Tina Downloader — Pengunduh Media & Metadata Serbaguna',
  description:
    'Platform pengunduh video, audio, gambar, dan ekstraktor metadata otomatis dari ribuan situs. Dikembangkan oleh Nimzz.',
  summary:
    'Aplikasi web untuk mengunduh video, audio, dan gambar dari berbagai platform serta mengekstrak metadata media seperti judul, pembuat, durasi, resolusi, dan codec.',
  locale: 'id_ID',
  language: 'id',
  author: 'Nimzz',
  applicationCategory: 'UtilitiesApplication',
  priceCurrency: 'IDR',
  keywords: [
    'Tina Downloader',
    'pengunduh media',
    'download video',
    'download TikTok tanpa watermark',
    'download video Instagram',
    'download video YouTube',
    'download audio MP3',
    'download foto carousel',
    'ekstraktor metadata',
    'yt-dlp',
    'Nimzz',
  ],
  features: [
    'Mengunduh video dalam beberapa pilihan resolusi',
    'Mengunduh audio dalam format MP3',
    'Mengunduh galeri foto dan menyusunnya menjadi PDF',
    'Mengekstrak metadata media: judul, pembuat, durasi, resolusi, codec, dan tag',
    'Mendukung TikTok, Instagram, YouTube, Facebook, X (Twitter), Pinterest, Pixiv, Bilibili, SoundCloud, dan banyak situs lain lewat yt-dlp',
    'Riwayat unduhan per perangkat',
    'REST API dengan halaman dokumentasi',
  ],
  api: [
    {
      method: 'POST',
      path: '/api/extract',
      description: 'Menerima body JSON berisi url, lalu mengembalikan metadata media dan daftar pilihan unduhan.',
    },
    {
      method: 'GET',
      path: '/api/download/:filename',
      description: 'Mengunduh berkas media dari URL stream hasil ekstraksi.',
    },
    {
      method: 'GET',
      path: '/api/supported-sites',
      description: 'Daftar platform yang didukung, dengan filter q dan category.',
    },
    {
      method: 'POST',
      path: '/api/compile-pdf',
      description: 'Menyusun daftar gambar menjadi satu berkas PDF.',
    },
  ],
  themeColor: { light: '#F3F6FC', dark: '#0C1020' },
  ogImage: {
    path: '/og-image.jpg',
    width: 1200,
    height: 630,
    type: 'image/jpeg',
    alt: 'Pratinjau Tina Downloader',
  },
  links: {
    github: 'https://github.com/NimzzAI',
  },
};

export function createSiteConfig(env: Env) {
  return {
    ...baseConfig,
    googleSiteVerification: env.GOOGLE_SITE_VERIFICATION || '',
    bingSiteVerification: env.BING_SITE_VERIFICATION || '',
  };
}

export type SiteConfig = ReturnType<typeof createSiteConfig>;
