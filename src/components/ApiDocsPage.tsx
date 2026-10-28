import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MediaMetadata } from '../types';

interface ApiDocsPageProps {
  deviceId: string;
  totalExtractors: number;
  lastExtractedMedia: MediaMetadata | null;
}

type CodeLang = 'curl' | 'typescript' | 'nodejs' | 'python' | 'go' | 'php';
type InspectorTab = 'visual' | 'json';

interface EndpointSpec {
  id: string;
  method: 'POST' | 'GET' | 'DELETE';
  path: string;
  title: string;
  category: string;
  summary: string;
  params: {
    name: string;
    location: 'body' | 'query' | 'path' | 'header';
    type: string;
    required: boolean;
    description: string;
  }[];
  sampleResponse: string;
}

const SANDBOX_PRESETS = [
  {
    label: 'Spotify Full Track (04:22)',
    icon: 'fa-brands fa-spotify',
    url: 'https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ',
  },
  {
    label: 'YouTube Video HD',
    icon: 'fa-brands fa-youtube',
    url: 'https://youtu.be/Sgt6yH9UM-c?si=dUP74ef5pdgEShXX',
  },
  {
    label: 'TikTok Tanpa Watermark',
    icon: 'fa-brands fa-tiktok',
    url: 'https://vm.tiktok.com/ZSgCBT3wv/',
  },
  {
    label: 'Pixiv Galeri Multi-Slide',
    icon: 'fa-regular fa-images',
    url: 'https://www.pixiv.net/en/artworks/90000005',
  },
];

const ENDPOINTS: EndpointSpec[] = [
  {
    id: 'extract',
    method: 'POST',
    path: '/api/extract',
    title: 'Ekstrak Media, Stream Resolusi & Metadata Penuh',
    category: 'CORE EXTRACTION',
    summary:
      'Mengekstrak tautan URL dari TikTok, YouTube, Spotify, Instagram, X, Pixiv, MediaFire, atau 1.600+ situs lainnya. Mengembalikan daftar stream video multi-resolusi, audio full-track MP3 320kbps, galeri foto multi-slide, serta metadata lengkap dalam format JSON.',
    params: [
      {
        name: 'url',
        location: 'body',
        type: 'string',
        required: true,
        description: 'Tautan URL lengkap media publik yang ingin diekstrak (http:// atau https://).',
      },
      {
        name: 'X-Device-ID',
        location: 'header',
        type: 'string',
        required: false,
        description: 'Identitas unik perangkat untuk pencatatan riwayat dan kuota rate-limit.',
      },
    ],
    sampleResponse: JSON.stringify(
      {
        status: 'ok',
        data: {
          title: 'Mangu — Fourtwnty, Charita Utami',
          author: 'Fourtwnty, Charita Utami',
          platform: 'spotify',
          extractorKey: 'TinaCore::Spotify',
          engine: 'Tina Hybrid',
          duration: '04:22',
          uploadDate: '2022-04-20',
          resolution: '320kbps HQ Full Audio',
          acodec: 'MP3 320kbps (44.1kHz)',
          filesizeApprox: '10.6 MB',
          thumbnail: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273fecb2b49d97ed68528fbf44a',
          webpageUrl: 'https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ',
          downloads: [
            {
              id: 'sp_0wULafSHeHYZFu54R9ZFRJ_full_320',
              type: 'audio',
              quality: 'Audio Full Track 320kbps · Mangu (MP3)',
              ext: 'mp3',
              resolution: '320kbps',
              filesizeFormatted: '10.6 MB',
              url: 'https://rapid.spotidown.app/v2?token=...',
            },
            {
              id: 'sp_0wULafSHeHYZFu54R9ZFRJ_cover',
              type: 'image',
              quality: 'Cover Artwork Resolusi Penuh (JPG)',
              ext: 'jpg',
              resolution: '640x640 HD',
              url: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273fecb2b49d97ed68528fbf44a',
            },
          ],
        },
      },
      null,
      2
    ),
  },
  {
    id: 'proxy-stream',
    method: 'GET',
    path: '/api/proxy-stream',
    title: 'Proxy Stream Media & HTTP 206 Byte-Range',
    category: 'MEDIA STREAMING',
    summary:
      'Mem-proxy stream video, audio MP3 full-track, atau gambar galeri dengan injeksi header Referer otomatis (Pixiv, Bilibili, TikTok, SpotiDown) serta dukungan penuh HTTP 206 Partial Content untuk timeline scrubbing di V10 Media Player.',
    params: [
      {
        name: 'url',
        location: 'query',
        type: 'string',
        required: true,
        description: 'URL stream asli dari array downloads[].url.',
      },
      {
        name: 'ext',
        location: 'query',
        type: 'string',
        required: false,
        description: 'Petunjuk ekstensi MIME eksplisit (mp4, mp3, jpg, png, webp).',
      },
      {
        name: 'Range',
        location: 'header',
        type: 'string',
        required: false,
        description: 'Rentang byte untuk streaming parsial (contoh: bytes=0-3499999).',
      },
    ],
    sampleResponse: `HTTP/1.1 206 Partial Content
Content-Type: audio/mpeg
Accept-Ranges: bytes
Content-Range: bytes 0-3499999/10595559
Access-Control-Allow-Origin: *

<Binary Media Stream Chunk>`,
  },
  {
    id: 'download',
    method: 'GET',
    path: '/api/download/:filename',
    title: 'Unduh Berkas Media Langsung (Attachment Binary)',
    category: 'FILE DELIVERY',
    summary:
      'Mengalirkan berkas media langsung dengan header Content-Disposition attachment dan MIME Type eksplisit (video/mp4, audio/mpeg, image/jpeg) agar otomatis tersimpan ke perangkat pengguna dengan nama berkas bersih.',
    params: [
      {
        name: 'filename',
        location: 'path',
        type: 'string',
        required: true,
        description: 'Nama berkas keluaran (contoh: Tina_Mangu_320kbps.mp3).',
      },
      {
        name: 'url',
        location: 'query',
        type: 'string',
        required: true,
        description: 'URL stream langsung yang diperoleh dari response /api/extract.',
      },
      {
        name: 'ext',
        location: 'query',
        type: 'string',
        required: false,
        description: 'Ekstensi berkas keluaran (mp4, mp3, jpg, png, pdf).',
      },
    ],
    sampleResponse: `HTTP/1.1 200 OK
Content-Type: audio/mpeg
Content-Disposition: attachment; filename="Tina_Mangu_320kbps.mp3"
Accept-Ranges: bytes

<Binary Media File>`,
  },
  {
    id: 'resolve',
    method: 'POST',
    path: '/api/resolve',
    title: 'Resolver Token Stream Dinamis',
    category: 'TOKEN RESOLVER',
    summary:
      'Menukarkan token internal (spotidown_resolve:, applemusic_resolve:, youtube_resolve:) menjadi URL CDN langsung berkecepatan tinggi.',
    params: [
      {
        name: 'tokenUrl',
        location: 'body',
        type: 'string',
        required: true,
        description: 'String tokenUrl dari objek stream yang memiliki properti needsResolve: true.',
      },
    ],
    sampleResponse: JSON.stringify(
      {
        status: 'ok',
        url: 'https://rapid.spotidown.app/v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
      null,
      2
    ),
  },
  {
    id: 'compile-pdf',
    method: 'POST',
    path: '/api/compile-pdf',
    title: 'Kompilasi Galeri Foto & Chapter Komik ke PDF',
    category: 'DOCUMENT ENGINE',
    summary:
      'Mengunduh hingga 60 URL gambar secara berurutan (slide foto TikTok, artwork multi-page Pixiv, atau chapter MangaDex/KomikIndo), menormalisasi dimensi JPEG, dan merakit dokumen PDF siap unduh.',
    params: [
      {
        name: 'images',
        location: 'body',
        type: 'string[]',
        required: true,
        description: 'Array berisi daftar URL gambar resolusi penuh yang akan digabungkan.',
      },
      {
        name: 'title',
        location: 'body',
        type: 'string',
        required: false,
        description: 'Judul dokumen untuk penamaan berkas PDF keluaran.',
      },
    ],
    sampleResponse: `HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="Tina_Gallery.pdf"

<Binary PDF Document>`,
  },
  {
    id: 'sites',
    method: 'GET',
    path: '/api/supported-sites',
    title: 'Direktori 1.615+ Platform & Ekstraktor',
    category: 'DIRECTORY',
    summary:
      'Mengambil daftar seluruh situs yang didukung beserta kategori dan deskripsi kapabilitas ekstraksinya.',
    params: [
      {
        name: 'q',
        location: 'query',
        type: 'string',
        required: false,
        description: 'Kata kunci pencarian nama platform (contoh: tiktok, spotify, pixiv, bilibili).',
      },
      {
        name: 'category',
        location: 'query',
        type: 'string',
        required: false,
        description: 'Filter kategori (all, sosial & video, musik & audio, cloud & berkas, komik & anime).',
      },
    ],
    sampleResponse: JSON.stringify(
      {
        total: 1615,
        filteredCount: 2,
        items: [
          {
            name: 'TikTok',
            category: 'Sosial & Video',
            description: 'Video 1080p/720p Tanpa Watermark, Audio MP3, & Galeri Foto Slideshow',
          },
          {
            name: 'Spotify',
            category: 'Musik & Audio',
            description: 'Track Audio MP3 320kbps Full Duration & Cover Art Metadata',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'history',
    method: 'GET',
    path: '/api/history',
    title: 'Sinkronisasi & Manajemen Riwayat Unduhan',
    category: 'ARCHIVE STORAGE',
    summary:
      'Mengambil atau menghapus riwayat ekstraksi berdasarkan kombinasi IP Address dan header X-Device-ID.',
    params: [
      {
        name: 'X-Device-ID',
        location: 'header',
        type: 'string',
        required: true,
        description: 'Fingerprint ID perangkat pengguna (contoh: TINA-DEV-XXXX).',
      },
    ],
    sampleResponse: JSON.stringify(
      {
        items: [
          {
            id: 'dl_1730102000_x8k2p',
            title: 'Mangu — Fourtwnty, Charita Utami',
            author: 'Fourtwnty, Charita Utami',
            platform: 'spotify',
            duration: '04:22',
            quality: '320kbps',
            createdAt: 1730102000000,
          },
        ],
      },
      null,
      2
    ),
  },
];

const STATUS_CODES = [
  {
    code: '200 OK',
    desc: 'Permintaan ekstraksi JSON atau pengambilan direktori berhasil diproses.',
  },
  {
    code: '206 Partial Content',
    desc: 'Streaming media byte-range pada /api/proxy-stream berhasil dikirimkan.',
  },
  {
    code: '302 Found',
    desc: 'Pengalihan langsung ke CDN upstream untuk berkas berukuran besar di lingkungan serverless.',
  },
  {
    code: '400 Bad Request',
    desc: 'Parameter URL kosong, tidak diawali http(s)://, atau format body JSON tidak valid.',
  },
  {
    code: '429 Too Many Requests',
    desc: 'Batas kuota rate-limit (15 request / 15 menit atau burst 5 request / 20 detik) tercapai.',
  },
  {
    code: '500 / 502 Error',
    desc: 'Platform sumber sedang memblokir akses publik atau tautan media bersifat privat/kedaluwarsa.',
  },
];

export const ApiDocsPage: React.FC<ApiDocsPageProps> = ({
  deviceId,
  totalExtractors,
  lastExtractedMedia,
}) => {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://tina-downloader.web.id';

  const [codeLang, setCodeLang] = useState<CodeLang>('curl');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('visual');
  const [activeEndpointFilter, setActiveEndpointFilter] = useState<string>('ALL');

  // Live API Sandbox state
  const [sandboxUrl, setSandboxUrl] = useState<string>(
    lastExtractedMedia?.webpageUrl || 'https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ'
  );
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);
  const [sandboxStatus, setSandboxStatus] = useState<number | null>(
    lastExtractedMedia ? 200 : null
  );
  const [sandboxLatency, setSandboxLatency] = useState<number | null>(null);
  const [sandboxResponse, setSandboxResponse] = useState<any>(
    lastExtractedMedia
      ? {
          status: 'ok',
          data: lastExtractedMedia,
        }
      : null
  );

  const targetSnippetUrl = sandboxUrl.trim() || 'https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ';

  const getCodeSnippet = (lang: CodeLang): string => {
    switch (lang) {
      case 'curl':
        return `curl -X POST "${origin}/api/extract" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-ID: ${deviceId}" \\
  -d '{
    "url": "${targetSnippetUrl}"
  }'`;
      case 'typescript':
        return `interface TinaExtractResponse {
  status: 'ok' | 'error';
  data: {
    title: string;
    author: string;
    platform: string;
    duration: string;
    thumbnail: string;
    downloads: Array<{
      id: string;
      type: 'video' | 'audio' | 'image' | 'file';
      quality: string;
      ext: string;
      url: string;
      resolution?: string;
      filesizeFormatted?: string;
    }>;
  };
}

const response = await fetch("${origin}/api/extract", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Device-ID": "${deviceId}",
  },
  body: JSON.stringify({
    url: "${targetSnippetUrl}",
  }),
});

const result: TinaExtractResponse = await response.json();
console.log("Judul Media:", result.data.title, "| Durasi:", result.data.duration);
console.log("Stream Utama:", result.data.downloads[0]);`;
      case 'nodejs':
        return `import axios from "axios";

async function extractWithTina(mediaUrl) {
  const { data } = await axios.post(
    "${origin}/api/extract",
    { url: mediaUrl },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Device-ID": "${deviceId}",
      },
      timeout: 30000,
    }
  );

  console.log("Title:", data.data.title);
  for (const stream of data.data.downloads) {
    console.log(\`[\${stream.type.toUpperCase()}] \${stream.quality} -> \${stream.url}\`);
  }
}

extractWithTina("${targetSnippetUrl}");`;
      case 'python':
        return `import requests

endpoint = "${origin}/api/extract"
headers = {
    "Content-Type": "application/json",
    "X-Device-ID": "${deviceId}",
}
payload = {
    "url": "${targetSnippetUrl}"
}

response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
response.raise_for_status()
media = response.json()["data"]

print(f"Judul   : {media['title']}")
print(f"Kreator : {media['author']} ({media['duration']})")
for idx, stream in enumerate(media["downloads"], 1):
    print(f"{idx}. [{stream['ext'].upper()}] {stream['quality']} -> {stream['url']}")`;
      case 'go':
        return `package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	payload := []byte(\`{"url": "${targetSnippetUrl}"}\`)
	req, _ := http.NewRequest("POST", "${origin}/api/extract", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Device-ID", "${deviceId}")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`;
      case 'php':
        return `<?php
$ch = curl_init("${origin}/api/extract");
$payload = json_encode([
    "url" => "${targetSnippetUrl}"
]);

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "X-Device-ID: ${deviceId}"
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
]);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
print_r($data["data"]);`;
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(getCodeSnippet(codeLang));
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleRunSandbox = async (customUrl?: string) => {
    const target = (customUrl ?? sandboxUrl).trim();
    if (!target) return;
    if (customUrl) setSandboxUrl(customUrl);
    setSandboxLoading(true);
    const t0 = performance.now();

    try {
      const { safeFetchJson, extractMediaClientFallback } = await import('../utils/clientFallback');
      const res = await safeFetchJson('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ url: target }),
      });

      if (res.ok && res.data?.data) {
        setSandboxStatus(res.status);
        setSandboxLatency(Math.round(performance.now() - t0));
        setSandboxResponse(res.data);
      } else {
        const fallbackData = await extractMediaClientFallback(target);
        setSandboxStatus(200);
        setSandboxLatency(Math.round(performance.now() - t0));
        setSandboxResponse({
          status: 'ok',
          data: fallbackData,
        });
      }
    } catch (err: any) {
      setSandboxStatus(500);
      setSandboxLatency(Math.round(performance.now() - t0));
      setSandboxResponse({
        error: err?.message || 'Gagal menghubungi endpoint /api/extract',
      });
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleCopySandboxJson = async () => {
    if (!sandboxResponse) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(sandboxResponse, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownloadSandboxJson = () => {
    if (!sandboxResponse) return;
    const jsonString = JSON.stringify(sandboxResponse, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tina_api_response_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredEndpoints =
    activeEndpointFilter === 'ALL'
      ? ENDPOINTS
      : ENDPOINTS.filter((ep) => ep.method === activeEndpointFilter);

  const sandboxMedia: MediaMetadata | null = sandboxResponse?.data || null;

  return (
    <motion.div
      key="view-api-docs"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="space-y-8"
    >
      {/* 1. API Documentation Header & Base Specification Ledger */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-6 sm:p-7 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <span className="w-2 h-2 rounded-xs bg-neutral-950 dark:bg-white inline-block" />
              <span>TINA DEVELOPER PORTAL & JSON INSPECTOR</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono font-bold text-neutral-800 dark:text-neutral-200">
                REST API v1.4
              </span>
              <span className="px-2.5 py-0.5 rounded bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-[11px] font-mono font-bold">
                HTTP 200 / 206 READY
              </span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Dokumentasi REST API, SDK & Raw JSON Inspector
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">
            Integrasikan mesin ekstraksi multi-platform <strong>Tina Downloader</strong> ke dalam
            aplikasi web, bot Telegram/WhatsApp, CLI, atau workflow otomasi Anda. Mendukung ekstraksi
            video tanpa watermark, audio MP3 320kbps durasi penuh, galeri multi-slide, dan kompilasi
            PDF secara instan.
          </p>
        </div>

        {/* 4-Column Hairline Specification Ledger */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800 bg-paper dark:bg-paper">
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              BASE ENDPOINT URL
            </div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1 truncate">
              {origin}/api
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              FORMAT & STREAMING
            </div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1">
              JSON + HTTP 206 Byte-Range
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              AUTENTIKASI & KEAMANAN
            </div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1">
              Publik (Header X-Device-ID)
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              CAKUPAN EKSTRAKTOR
            </div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1 tabular-nums">
              {totalExtractors.toLocaleString('id-ID')}+ Situs Aktif
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Live API Sandbox & Dual-Mode Inspector */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                INTERACTIVE API SANDBOX
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-neutral-950 dark:text-white mt-0.5">
                Uji Coba Endpoint & Inspeksi Payload Secara Langsung
              </h2>
            </div>
            {sandboxStatus && (
              <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                <span className="px-2.5 py-1 rounded bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold">
                  HTTP {sandboxStatus}
                </span>
                {sandboxLatency !== null && (
                  <span className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {sandboxLatency} ms
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Request Input Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center px-3 py-2.5 bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-lg font-mono text-xs font-bold shrink-0">
              POST /api/extract
            </div>
            <input
              type="url"
              value={sandboxUrl}
              onChange={(e) => setSandboxUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunSandbox();
              }}
              placeholder="Tempel tautan TikTok, YouTube, Spotify, atau Pixiv untuk menguji API..."
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm font-mono bg-paper dark:bg-paper border border-neutral-300 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300 text-neutral-950 dark:text-white"
            />
            <button
              type="button"
              onClick={() => handleRunSandbox()}
              disabled={sandboxLoading}
              className="px-5 py-2.5 text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              {sandboxLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin mr-1.5" />
                  Mengekstrak...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-bolt mr-1.5" />
                  Kirim Request
                </>
              )}
            </button>
          </div>

          {/* 1-Click Preset Test Links */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-[11px] font-mono text-neutral-400">Preset Uji Cepat:</span>
            {SANDBOX_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleRunSandbox(preset.url)}
                className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                  sandboxUrl === preset.url
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                }`}
              >
                <i className={`${preset.icon} mr-1.5`} />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sandbox Output Bar: Switch between Visual Stream Inspector & Raw JSON */}
        <div className="px-5 py-2.5 bg-neutral-950 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setInspectorTab('visual')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                inspectorTab === 'visual'
                  ? 'bg-white text-neutral-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-table-list mr-1.5" />
              Ringkasan & Stream ({sandboxMedia?.downloads?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab('json')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                inspectorTab === 'json'
                  ? 'bg-white text-neutral-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-code mr-1.5" />
              Raw JSON Payload
            </button>
          </div>

          {sandboxResponse && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySandboxJson}
                className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
              >
                <i className={`fa-solid ${copiedJson ? 'fa-check' : 'fa-copy'} mr-1.5`} />
                {copiedJson ? 'JSON Tersalin' : 'Salin JSON'}
              </button>
              <button
                type="button"
                onClick={handleDownloadSandboxJson}
                className="px-2.5 py-1 rounded bg-white text-neutral-950 font-sans font-bold hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-download mr-1.5" />
                Unduh .JSON
              </button>
            </div>
          )}
        </div>

        {/* Sandbox Output Content */}
        {inspectorTab === 'visual' && sandboxMedia ? (
          <div className="p-5 sm:p-6 bg-neutral-950 text-neutral-100 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3.5 min-w-0">
                {sandboxMedia.thumbnail && (
                  <img
                    src={sandboxMedia.thumbnail}
                    alt={sandboxMedia.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-lg object-cover border border-neutral-800 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-400">
                    <span className="uppercase font-bold text-white">{sandboxMedia.platform}</span>
                    <span>·</span>
                    <span>{sandboxMedia.extractorKey || 'TinaCore'}</span>
                    {sandboxMedia.duration && (
                      <>
                        <span>·</span>
                        <span className="text-white font-bold">Durasi {sandboxMedia.duration}</span>
                      </>
                    )}
                  </div>
                  <div className="text-sm font-bold text-white truncate mt-0.5">
                    {sandboxMedia.title}
                  </div>
                  <div className="text-xs text-neutral-400 truncate mt-0.5">
                    Kreator: {sandboxMedia.author} · Kualitas: {sandboxMedia.resolution || 'Original HD'}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-neutral-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/70 text-[11px] uppercase text-neutral-400">
                    <th className="py-2 px-3">Stream ID</th>
                    <th className="py-2 px-3">Tipe</th>
                    <th className="py-2 px-3">Kualitas & Codec</th>
                    <th className="py-2 px-3 text-right">Ukuran</th>
                    <th className="py-2 px-3 text-right">Stream URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {(sandboxMedia.downloads || []).map((s, idx) => (
                    <tr key={s.id || idx} className="hover:bg-neutral-900/50">
                      <td className="py-2 px-3 text-neutral-400">{s.id || `stream_${idx + 1}`}</td>
                      <td className="py-2 px-3 uppercase font-bold text-white">{s.type}</td>
                      <td className="py-2 px-3 text-neutral-200 font-sans">{s.quality}</td>
                      <td className="py-2 px-3 text-right text-neutral-300 tabular-nums">
                        {s.filesizeFormatted || '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white underline underline-offset-2 hover:text-neutral-300"
                        >
                          Buka Stream
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <pre className="p-5 bg-neutral-950 text-neutral-200 text-[11px] sm:text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {sandboxResponse
              ? JSON.stringify(sandboxResponse, null, 2)
              : '// Klik salah satu preset di atas atau tekan "Kirim Request" untuk menginspeksi response JSON secara langsung.'}
          </pre>
        )}
      </section>

      {/* 3. Dynamic 6-Language SDK Code Generator */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-paper dark:bg-paper border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-200/70 dark:bg-neutral-900 rounded-lg border border-neutral-300/60 dark:border-neutral-800">
            {(
              [
                ['curl', 'cURL'],
                ['typescript', 'TypeScript / Fetch'],
                ['nodejs', 'Node.js / Axios'],
                ['python', 'Python 3'],
                ['go', 'Golang'],
                ['php', 'PHP'],
              ] as [CodeLang, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCodeLang(id)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  codeLang === id
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 text-xs font-bold border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <i className={`fa-solid ${copiedCode ? 'fa-check' : 'fa-copy'} mr-1.5`} />
            {copiedCode ? 'Kode Tersalin' : 'Salin Kode SDK'}
          </button>
        </div>

        <pre className="p-5 bg-neutral-950 text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed">
          {getCodeSnippet(codeLang)}
        </pre>
      </section>

      {/* 4. Complete 7-Endpoint Reference List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-neutral-950 dark:text-white">
              Referensi Lengkap Endpoint REST API ({filteredEndpoints.length})
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Seluruh rute di bawah ini tersedia baik di server Node.js Hybrid maupun Vercel Python Serverless.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-mono">
            {['ALL', 'POST', 'GET'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setActiveEndpointFilter(m)}
                className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                  activeEndpointFilter === m
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredEndpoints.map((ep) => (
            <div
              key={ep.id}
              className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden"
            >
              <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                        ep.method === 'POST'
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <code className="text-xs sm:text-sm font-mono font-bold text-neutral-950 dark:text-white">
                      {ep.path}
                    </code>
                    <span className="text-xs font-semibold text-neutral-500">— {ep.title}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-paper dark:bg-paper border border-neutral-200 dark:border-neutral-800 text-neutral-500">
                    {ep.category}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {ep.summary}
                </p>
              </div>

              {/* Parameter Table */}
              <div className="overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-paper dark:bg-paper border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-mono uppercase text-neutral-500">
                      <th className="py-2.5 px-4">Parameter</th>
                      <th className="py-2.5 px-4">Lokasi</th>
                      <th className="py-2.5 px-4">Tipe</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {ep.params.map((param) => (
                      <tr key={param.name}>
                        <td className="py-2.5 px-4 font-mono font-bold text-neutral-950 dark:text-white whitespace-nowrap">
                          {param.name}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-neutral-500 uppercase">
                          {param.location}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-neutral-600 dark:text-neutral-300">
                          {param.type}
                        </td>
                        <td className="py-2.5 px-4">
                          {param.required ? (
                            <span className="font-mono font-bold text-neutral-950 dark:text-white">
                              Wajib
                            </span>
                          ) : (
                            <span className="text-neutral-400">Opsional</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-600 dark:text-neutral-400">
                          {param.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sample Response */}
              <div className="bg-neutral-950 text-neutral-300">
                <div className="px-4 py-2 border-b border-neutral-800 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  CONTOH RESPONSE ({ep.path})
                </div>
                <pre className="p-4 text-[11px] font-mono overflow-x-auto leading-relaxed">
                  {ep.sampleResponse}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. HTTP Status Codes & Rate Limit Specification */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-base font-extrabold text-neutral-950 dark:text-white">
            Kode Status HTTP & Kebijakan Rate-Limit
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Standar respons HTTP dan perlindungan kuota otomatis berbasis IP Address + Device Fingerprint.
          </p>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
          {STATUS_CODES.map((st) => (
            <div
              key={st.code}
              className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <code className="font-mono font-bold text-neutral-950 dark:text-white shrink-0">
                {st.code}
              </code>
              <span className="text-neutral-600 dark:text-neutral-400 sm:text-right">{st.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};
