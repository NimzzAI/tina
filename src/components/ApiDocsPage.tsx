import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MediaMetadata } from '../types';

interface ApiDocsPageProps {
  deviceId: string;
  totalExtractors: number;
  lastExtractedMedia: MediaMetadata | null;
}

type CodeLang = 'curl' | 'javascript' | 'python' | 'go';

interface EndpointSpec {
  id: string;
  method: 'POST' | 'GET';
  path: string;
  title: string;
  summary: string;
  params: {
    name: string;
    location: 'body' | 'query' | 'path';
    type: string;
    required: boolean;
    description: string;
  }[];
  sampleResponse: string;
}

const ENDPOINTS: EndpointSpec[] = [
  {
    id: 'extract',
    method: 'POST',
    path: '/api/extract',
    title: 'Ekstrak Media & Daftar Resolusi',
    summary:
      'Mengekstrak tautan URL dari TikTok, YouTube, Instagram, Spotify, X, Pixiv, MediaFire, atau 1.600+ situs lainnya dan mengembalikan daftar stream video, audio, galeri foto, serta metadata lengkap dalam format JSON.',
    params: [
      {
        name: 'url',
        location: 'body',
        type: 'string',
        required: true,
        description: 'Tautan URL lengkap media publik yang ingin diekstrak.',
      },
    ],
    sampleResponse: JSON.stringify(
      {
        status: 'ok',
        data: {
          title: 'Contoh Video TikTok Tanpa Watermark',
          author: '@nimzz_bocil_pokemon',
          platform: 'TikTok',
          duration: '00:19',
          resolution: '1080x1920',
          thumbnail: 'https://example.com/thumb.jpg',
          webpageUrl: 'https://vm.tiktok.com/ZSgCBT3wv/',
          viewCount: 142500,
          likeCount: 19400,
          commentCount: 620,
          downloads: [
            {
              id: 'tiktok_hd_1080p',
              type: 'video',
              quality: 'Video 1080p Full HD (Tanpa Watermark)',
              ext: 'mp4',
              resolution: '1080p',
              filesizeFormatted: '11.4 MB',
              url: 'https://...',
            },
            {
              id: 'tiktok_audio_mp3',
              type: 'audio',
              quality: 'Original Audio / Musik (MP3)',
              ext: 'mp3',
              resolution: 'Audio MP3',
              url: 'https://...',
            },
          ],
        },
      },
      null,
      2
    ),
  },
  {
    id: 'download',
    method: 'GET',
    path: '/api/download/:filename',
    title: 'Unduh Berkas Media Langsung (Binary Stream)',
    summary:
      'Mengalirkan berkas media langsung dengan header Content-Disposition attachment dan MIME Type eksplisit (video/mp4, audio/mpeg, image/jpeg) agar otomatis tersimpan sebagai file media yang valid.',
    params: [
      {
        name: 'filename',
        location: 'path',
        type: 'string',
        required: true,
        description: 'Nama berkas keluaran (contoh: Tina_Video_1080p.mp4).',
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
        description: 'Ekstensi berkas (mp4, mp3, jpg, png, pdf).',
      },
    ],
    sampleResponse: `HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Disposition: attachment; filename="Tina_Video_1080p.mp4"
Accept-Ranges: bytes

<Binary Media Stream>`,
  },
  {
    id: 'sites',
    method: 'GET',
    path: '/api/supported-sites',
    title: 'Direktori Platform & Ekstraktor',
    summary:
      'Mengambil daftar seluruh situs yang didukung beserta kategori dan kapabilitas ekstraksinya.',
    params: [
      {
        name: 'q',
        location: 'query',
        type: 'string',
        required: false,
        description: 'Kata kunci pencarian nama platform (contoh: tiktok, youtube, pixiv).',
      },
      {
        name: 'category',
        location: 'query',
        type: 'string',
        required: false,
        description: 'Filter kategori platform (all, sosial & video, musik & audio, dll).',
      },
    ],
    sampleResponse: JSON.stringify(
      {
        total: 1615,
        count: 2,
        items: [
          {
            name: 'tiktok',
            category: 'Sosial & Video',
            description: 'Unduh video HD tanpa watermark, musik MP3, dan slide foto TikTok',
          },
          {
            name: 'youtube',
            category: 'Sosial & Video',
            description: 'Unduh video multi-resolusi (1080p/720p/480p), Shorts, dan audio MP3',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'compile-pdf',
    method: 'POST',
    path: '/api/compile-pdf',
    title: 'Kompilasi Multi-Foto menjadi PDF',
    summary:
      'Menggabungkan array URL gambar (slide foto TikTok, galeri Pixiv, atau chapter komik) menjadi satu dokumen PDF siap unduh.',
    params: [
      {
        name: 'images',
        location: 'body',
        type: 'string[]',
        required: true,
        description: 'Array berisi daftar URL gambar yang akan digabungkan secara berurutan.',
      },
      {
        name: 'title',
        location: 'body',
        type: 'string',
        required: false,
        description: 'Judul dokumen PDF.',
      },
    ],
    sampleResponse: `HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="Tina_Gallery.pdf"

<Binary PDF Document>`,
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

  // Live API Sandbox state
  const [sandboxUrl, setSandboxUrl] = useState<string>('https://vm.tiktok.com/ZSgCBT3wv/');
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

  const getCodeSnippet = (lang: CodeLang): string => {
    switch (lang) {
      case 'curl':
        return `curl -X POST "${origin}/api/extract" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://vm.tiktok.com/ZSgCBT3wv/"
  }'`;
      case 'javascript':
        return `const response = await fetch("${origin}/api/extract", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://vm.tiktok.com/ZSgCBT3wv/",
  }),
});

const result = await response.json();
console.log("Judul:", result.data.title);
console.log("Daftar Unduhan:", result.data.downloads);`;
      case 'python':
        return `import requests

url = "${origin}/api/extract"
payload = {
    "url": "https://vm.tiktok.com/ZSgCBT3wv/"
}

response = requests.post(url, json=payload, timeout=30)
data = response.json()

print("Judul:", data["data"]["title"])
for stream in data["data"]["downloads"]:
    print(stream["quality"], "->", stream["url"])`;
      case 'go':
        return `package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	body := []byte(\`{"url": "https://vm.tiktok.com/ZSgCBT3wv/"}\`)
	resp, err := http.Post("${origin}/api/extract", "application/json", bytes.NewBuffer(body))
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	resBytes, _ := io.ReadAll(resp.Body)
	fmt.Println(string(resBytes))
}`;
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

  const handleRunSandbox = async () => {
    if (!sandboxUrl.trim()) return;
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
        body: JSON.stringify({ url: sandboxUrl.trim() }),
      });

      if (res.ok && res.data?.data) {
        setSandboxStatus(res.status);
        setSandboxLatency(Math.round(performance.now() - t0));
        setSandboxResponse(res.data);
      } else {
        const fallbackData = await extractMediaClientFallback(sandboxUrl.trim());
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

  return (
    <motion.div
      key="view-api-docs"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="space-y-8"
    >
      {/* 1. API Documentation Header & Base Specification */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              DEVELOPER REFERENCE & JSON INSPECTOR
            </span>
            <span className="px-2.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono font-bold text-neutral-800 dark:text-neutral-200">
              REST API v1
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
            Dokumentasi API & JSON Metadata
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">
            Halaman khusus pengembang untuk mengintegrasikan layanan ekstraksi media{' '}
            <strong>Tina Downloader</strong> ke aplikasi, bot, atau skrip Anda, serta memeriksa
            struktur <em>Raw JSON Metadata</em> secara langsung.
          </p>
        </div>

        {/* 4-Column Hairline Ledger: Base URL, Format, Auth, Supported Sites */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800 bg-paper dark:bg-paper">
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase text-neutral-400">BASE URL</div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1 truncate">
              {origin}
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase text-neutral-400">FORMAT RESPONSE</div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1">
              application/json
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase text-neutral-400">AUTENTIKASI</div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1">
              Tanpa API Key (Publik)
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-mono uppercase text-neutral-400">CAKUPAN EKSTRAKTOR</div>
            <div className="text-xs font-mono font-bold text-neutral-950 dark:text-white mt-1">
              {totalExtractors.toLocaleString('id-ID')}+ Situs Aktif
            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Integration Code Examples (cURL, JS, Python, Go) */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-paper dark:bg-paper border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-neutral-200/70 dark:bg-neutral-900 rounded-lg border border-neutral-300/60 dark:border-neutral-800">
            {(
              [
                ['curl', 'cURL'],
                ['javascript', 'JavaScript'],
                ['python', 'Python'],
                ['go', 'Golang'],
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
            {copiedCode ? 'Tersalin' : 'Salin Kode'}
          </button>
        </div>

        <pre className="p-5 bg-neutral-950 text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed">
          {getCodeSnippet(codeLang)}
        </pre>
      </section>

      {/* 3. Live API Playground & Raw JSON Metadata Inspector */}
      <section className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-neutral-950 dark:text-white">
                Uji Coba Endpoint & Raw JSON Metadata Inspector
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Uji request <code className="font-mono">POST /api/extract</code> secara langsung
                untuk melihat struktur JSON, parameter codec, dan daftar URL stream.
              </p>
            </div>
            {sandboxStatus && (
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2.5 py-1 rounded bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold">
                  HTTP {sandboxStatus}
                </span>
                {sandboxLatency !== null && (
                  <span className="text-neutral-500">{sandboxLatency} ms</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center px-3 py-2 bg-paper dark:bg-paper border border-neutral-300 dark:border-neutral-800 rounded-lg font-mono text-xs font-bold text-neutral-950 dark:text-white shrink-0">
              POST /api/extract
            </div>
            <input
              type="url"
              value={sandboxUrl}
              onChange={(e) => setSandboxUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunSandbox();
              }}
              placeholder="Masukkan URL media untuk melihat response JSON..."
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm font-mono bg-paper dark:bg-paper border border-neutral-300 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
            />
            <button
              type="button"
              onClick={handleRunSandbox}
              disabled={sandboxLoading}
              className="px-4 py-2 text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              {sandboxLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin mr-1.5" />
                  Mengirim...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane mr-1.5" />
                  Kirim Request
                </>
              )}
            </button>
          </div>
        </div>

        {/* JSON Output Console */}
        <div className="bg-neutral-950 text-neutral-200">
          <div className="px-5 py-2.5 border-b border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>RESPONSE BODY (JSON)</span>
            {sandboxResponse && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySandboxJson}
                  className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                >
                  <i className={`fa-solid ${copiedJson ? 'fa-check' : 'fa-copy'} mr-1.5`} />
                  {copiedJson ? 'Disalin' : 'Salin JSON'}
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
          <pre className="p-5 text-[11px] sm:text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {sandboxResponse
              ? JSON.stringify(sandboxResponse, null, 2)
              : '// Klik "Kirim Request" di atas untuk menginspeksi response JSON secara langsung.'}
          </pre>
        </div>
      </section>

      {/* 4. Complete Endpoint Reference List */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold text-neutral-950 dark:text-white">
            Daftar Endpoint API
          </h2>
          <span className="text-[11px] font-mono text-neutral-400">
            {ENDPOINTS.length} ENDPOINTS
          </span>
        </div>

        <div className="space-y-4">
          {ENDPOINTS.map((ep) => (
            <div
              key={ep.id}
              className="bg-white dark:bg-surface border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden"
            >
              <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
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
                      <th className="py-2.5 px-4">Wajib</th>
                      <th className="py-2.5 px-4">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {ep.params.map((p) => (
                      <tr key={p.name}>
                        <td className="py-2.5 px-4 font-mono font-bold text-neutral-950 dark:text-white">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-neutral-500 uppercase">
                          {p.location}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-neutral-500">{p.type}</td>
                        <td className="py-2.5 px-4 font-mono">
                          {p.required ? (
                            <span className="font-bold text-neutral-950 dark:text-white">Ya</span>
                          ) : (
                            <span className="text-neutral-400">Opsional</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-600 dark:text-neutral-300">
                          {p.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Example Response */}
              <div className="bg-neutral-950 text-neutral-300">
                <div className="px-4 py-2 border-b border-neutral-800 text-[10px] font-mono uppercase text-neutral-500">
                  CONTOH RESPONSE
                </div>
                <pre className="p-4 text-[11px] font-mono overflow-x-auto leading-relaxed">
                  {ep.sampleResponse}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};
