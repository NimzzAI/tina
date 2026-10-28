<div align="center">

<img src="public/readme.jpg" alt="Tina Downloader Official Banner" width="100%" />

<br />

# TINA DOWNLOADER — V10.5 MONOCHROME EDITION

**Enterprise-Grade Multi-Engine Media Extraction Studio, Full-Track 320kbps Audio Resolver, V10 Custom Media Player & REST API v1.4**  
*Designed, Engineered, and Maintained by **[Nimzz (@NimzzAi)](https://github.com/NimzzAi)***

[![Platforms Supported](https://img.shields.io/badge/Supported_Sites-1,615%2B_Active-09090B?style=flat-square&logo= globe&logoColor=white)](#6-supported-platforms--native-scrapers-1615-sites)
[![Audio Engine](https://img.shields.io/badge/Audio_Engine-Full_Track_320kbps_MP3-18181B?style=flat-square&logo=spotify&logoColor=white)](#4-full-track-audio--v10-media-player-architecture)
[![Architecture](https://img.shields.io/badge/Core_Engine-Node.js_%2B_Python_%2B_Golang-27272A?style=flat-square&logo=go&logoColor=white)](#3-tri-engine--serverless-system-architecture)
[![UI Discipline](https://img.shields.io/badge/UI_Standard-Impeccable_%C2%B7_No--Slop_Monochrome-09090B?style=flat-square)](#2-design-system--anti-slop-ui-engineering)
[![Vercel Serverless](https://img.shields.io/badge/Deployment-Vercel_Edge_%26_Docker_Ready-18181B?style=flat-square&logo=vercel&logoColor=white)](#10-deployment-guide-vercel-docker--vps)

[**Live Application**](#) · [**REST API v1.4 Reference**](#7-rest-api-v14-complete-specification) · [**WhatsApp Official Channel**](https://whatsapp.com/channel/0029VbBhZWdGJP8HlbGaE63Q) · [**GitHub @NimzzAi**](https://github.com/NimzzAi) · [**Telegram @Nimzz4**](https://t.me/Nimzz4)

</div>

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Design System & Anti-Slop UI Engineering](#2-design-system--anti-slop-ui-engineering)
3. [Tri-Engine & Serverless System Architecture](#3-tri-engine--serverless-system-architecture)
4. [Full-Track Audio & V10 Media Player Architecture](#4-full-track-audio--v10-media-player-architecture)
5. [Core Product Modules & Studio Pages](#5-core-product-modules--studio-pages)
6. [Supported Platforms & Native Scrapers (1,615+ Sites)](#6-supported-platforms--native-scrapers-1615-sites)
7. [REST API v1.4 Complete Specification](#7-rest-api-v14-complete-specification)
8. [Multi-Language SDK Integration Examples](#8-multi-language-sdk-integration-examples)
9. [Security, Rate Limiting & Device Fingerprinting](#9-security-rate-limiting--device-fingerprinting)
10. [Deployment Guide (Vercel, Docker & VPS)](#10-deployment-guide-vercel-docker--vps)
11. [Project Directory Structure](#11-project-directory-structure)
12. [Troubleshooting & Engineering FAQ](#12-troubleshooting--engineering-faq)
13. [Developer Profile — Nimzz](#13-developer-profile--nimzz)

---

## 1. Executive Overview

**Tina Downloader** is a full-stack media extraction platform, in-browser streaming studio, and public developer API built to download high-definition videos without watermarks, **full-duration 320kbps MP3 audio tracks**, multi-slide photo galleries, cloud archives, and manga/comic chapters from **1,615+ global websites**.

Unlike conventional web downloaders that suffer from broken CORS streams, 29-second audio preview clips, or cluttered ad-heavy templates, Tina Downloader is engineered from the ground up with:

- **Full-Duration 320kbps Audio Resolution**: Extracts the complete, unclipped master audio track (e.g., full `04:22` / `10.6 MB` MP3 for Spotify tracks via multi-stage token resolution) rather than 29-second embed previews.
- **V10 Custom HTML5 Media Studio**: Built-in video player, full-track audio deck, and interactive multi-slide photo carousel powered by an HTTP `206 Partial Content` byte-range streaming proxy (`/api/proxy-stream`).
- **Dual-Runtime Parity**: Runs seamlessly on both **Full-Stack Node.js + Python + Go VPS/Container environments** (`server.ts`) and **Vercel Python Serverless Functions** (`api/extract.py`).
- **Zero-Login Archive & Playback Ledger**: Persistent download history (`SQLite3 WAL` + `localStorage`) with 4-column category analytics, instant search/sorting, JSON export, and 1-click studio replay.
- **Interactive Developer Portal & API Sandbox**: Dedicated REST API v1.4 documentation featuring a live request sandbox, dual-mode visual/JSON response inspector, and dynamic 6-language SDK code generator.

---

## 2. Design System & Anti-Slop UI Engineering

Tina Downloader's interface is crafted in strict accordance with modern frontend engineering standards:
- **[pbakaus/impeccable](https://github.com/pbakaus/impeccable)** — Precision typography, intentional spatial hierarchy, and tactile interaction states.
- **[LeoStehlik/no-slop-ui](https://github.com/LeoStehlik/no-slop-ui)** — Functional density, explicit tabular metrics, and zero decorative filler.
- **[github/awesome-copilot — anti-ui-slop](https://github.com/github/awesome-copilot/tree/main/skills/anti-ui-slop)** — Elimination of generic AI gradients, floating blobs, nested card bloat, and pill-badge spam.

### 2.1 Monochrome Architectural Palette

| Token Role | Light Mode (`:root`) | Dark Mode (`.dark`) | Engineering Usage |
| :--- | :--- | :--- | :--- |
| **Canvas (`--color-paper`)** | `#FAFAFA` (Alabaster) | `#09090B` (Carbon Black) | Primary viewport background |
| **Elevated Surface (`--color-surface`)** | `#FFFFFF` (Pure White) | `#121215` (Obsidian Slate) | Studio containers, tables, & ledgers |
| **Primary Ink (`--color-ink`)** | `#09090B` (Deep Ink) | `#FAFAFA` (Crisp White) | Headings, primary labels, active controls |
| **Muted Ink (`--color-muted`)** | `#52525B` (Zinc 600) | `#A1A1AA` (Zinc 400) | Secondary descriptions & metadata |
| **Hairline Border (`--color-line`)** | `#E4E4E7` (Zinc 200) | `#27272A` (Zinc 800) | 1px structural grid & table dividers |
| **Primary Action (`--color-accent`)** | `#09090B` (Solid Black) | `#FAFAFA` (Solid White) | High-contrast buttons & active tabs |

### 2.2 Typographic Hierarchy & Numeric Discipline

- **Display Wordmark & Headings (`--font-display`)**: `Unbounded` (weights `500–800`) for unmistakable structural anchoring.
- **Interface & Editorial Copy (`--font-sans`)**: `Onest` (weights `400–700`) for effortless legibility at high information density.
- **Technical & Telemetry Ledger (`--font-mono`)**: `JetBrains Mono` with mandatory `font-variant-numeric: tabular-nums` across all timecodes (`04:22`), file sizes (`10.6 MB`), HTTP status codes (`HTTP 200`), and extractor counts (`1.615`).

---

## 3. Tri-Engine & Serverless System Architecture

Tina Downloader operates a **Hybrid Multi-Engine Pipeline** that automatically adapts to its hosting environment:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT SPA (React 19 + Tailwind v4)                       │
│   • V10 Video & Full-Track Audio Player   • URL & Session State Persistence      │
│   • Interactive Photo Carousel & Lightbox • Client-Side Safe Fallback Engine     │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                        HTTPS JSON / HTTP 206 Byte-Range
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED API GATEWAY (/api/* Router)                          │
├───────────────────────────────────────┬──────────────────────────────────────────┤
│   MODE A: FULL-STACK SERVER (VPS)     │   MODE B: VERCEL SERVERLESS EDGE         │
│   Entry: /server.ts (Express + Vite)  │   Entry: /api/extract.py (Python 3.12)   │
├───────────────────────────────────────┼──────────────────────────────────────────┤
│ 1. Go 1.22 Security Worker            │ 1. Native TikWM HD No-Watermark Engine   │
│    • Dual-Bucket Rate Limiter         │ 2. SpotiDown Full-Track 320kbps Resolver │
│    • Concurrent Stream Header Probe   │    + Spotify Embed __NEXT_DATA__ Parser  │
│ 2. Node.js Mori Engine (45+ Scrapers) │ 3. YouTube Piped Streams + oEmbed Engine │
│    • TikTok, SpotiDown, IG, FB, X     │ 4. Pixiv Ajax Multi-Page Mirror Engine   │
│    • MediaFire, TeraBox, Manga PDF    │ 5. 3.5MB Chunked HTTP 206 Range Proxy    │
│ 3. Python 3.11 yt-dlp + SQLite3 WAL   │    (Bypasses Vercel 4.5MB payload cap)   │
└───────────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 4. Full-Track Audio & V10 Media Player Architecture

### 4.1 Why Audio Never Stops at 29 Seconds

Many web extractors rely solely on Spotify's public embed `__NEXT_DATA__` (`entity.audioPreview.url`), which points to `https://p.scdn.co/mp3-preview/...`—a **29.7-second preview clip**.

**Tina Downloader solves this at both the extractor and streaming layers:**

1. **Multi-Stage SpotiDown Full-Track Resolution**:
   - Both `/server.ts` (`mori-engine.js`) and `/api/extract.py` (`fetch_spotidown_full_mp3`) perform a stateful session handshake with `spotidown.app/action` and `spotidown.app/action/track` using cookie-jar persistence and CSRF field extraction.
   - This yields a direct, signed master stream (`https://rapid.spotidown.app/v2?token=...`) containing the **entire 320kbps MP3 track** (e.g., `10,595,559 bytes` / `10.6 MB` / `04:22` full duration for *Mangu — Fourtwnty, Charita Utami*).
2. **Stream Priority & Deduplication Guard**:
   - In `/server.ts` and `/api/extract.py`, the full-length 320kbps stream is strictly prioritized at `downloads[0]` (`Audio Full Track 320kbps`), while any 30-second preview is isolated as an optional ringtone stream (`Audio Ringtone / Preview 30s`) so it never overwrites the full song.
3. **Metadata Duration Synchronization (`durationHint`)**:
   - `V10AudioPlayer` parses the exact track duration from metadata (`durationHint="04:22"`) immediately on mount and verifies loaded HTML5 `<audio>` duration headers so the timeline scrubber accurately reflects the full song length.

### 4.2 HTTP 206 Partial Content Streaming Proxy (`/api/proxy-stream`)

- Injects platform-specific `Referer` and `User-Agent` headers (`https://spotidown.app/`, `https://www.pixiv.net/`, `https://www.bilibili.com/`, `https://www.tiktok.com/`).
- Translates upstream `application/octet-stream` headers into explicit browser-playable MIME types (`video/mp4`, `audio/mpeg`, `image/jpeg`).
- On Vercel Serverless, slices byte-range requests into `3.5 MB` chunks (`bytes=start-end`) so arbitrary-size HD videos and 10+ MB MP3 files stream and seek smoothly without triggering `FUNCTION_PAYLOAD_TOO_LARGE`.

---

## 5. Core Product Modules & Studio Pages

| Route / Tab | Module Name | Key Capabilities |
| :--- | :--- | :--- |
| `/` (`downloader`) | **Beranda Unduhan (Media Studio)** | Instant URL extraction, 1-click quick test presets (TikTok, YouTube, Spotify Full Track, Pixiv), V10 Video Player, V10 Audio Deck, Interactive Photo Carousel, Lightbox, & 1-click PDF compiler. |
| `/history` | **Riwayat Unduhan & Pustaka Media** | 4-column summary metrics ledger (`Total`, `Video`, `Musik`, `Foto`), category filter tabs, real-time search, sort selector (`Terbaru`, `Terlama`, `Judul A–Z`), JSON archive export, and 1-click **"Putar di Studio"**. |
| `/sites` | **Direktori 1.615+ Situs** | Instant client-indexed search and category filtering across all 1,615+ supported domains and global extractors. |
| `/api-docs` | **Dokumentasi API & JSON Inspector** | Interactive `POST /api/extract` live sandbox with preset test pills, Dual-Mode Inspector (`Ringkasan & Stream` table + `Raw JSON`), 6-language SDK code generator, and 7-endpoint specification. |
| `/about` | **Tentang & FAQ** | Architecture overview and interactive accordion guide. |
| `/developer` | **Profile Developer — Nimzz** | Editorial developer showcase for **Nimzz (`@NimzzAi`)** with clean non-overlapping banner/avatar split, interactive project launcher, tech stack matrix, and official social channels. |

---

## 6. Supported Platforms & Native Scrapers (1,615+ Sites)

| Category | Featured Platforms | Extraction Capabilities |
| :--- | :--- | :--- |
| **Social & Short Video** | TikTok, Douyin, Instagram, CapCut, RedNote (Xiaohongshu), Threads, Facebook, Twitter / X, Reddit, Pinterest | 1080p/720p MP4 **No Watermark**, Original MP3 Audio, Multi-Slide Photo Carousels |
| **Video Streaming** | YouTube, YouTube Shorts, Bilibili, Vimeo, Dailymotion, Twitch Clips, Rumble | Multi-resolution MP4 (`4K` / `1080p` / `720p` / `480p`), Direct Stream & Embed Fallback, Audio Track |
| **Music & Audio** | Spotify, SoundCloud, Apple Music, Bandcamp, Deezer, Mixcloud | **Full-Length 320kbps / 128kbps MP3**, High-Resolution Cover Artwork (`640x640 HD`), ID3 Metadata |
| **Art, Manga & Anime** | Pixiv, MangaDex, Kiryuu, KomikCast, KomikIndo, Otakudesu, Nimegami, Gogoanime | Original-resolution multi-page illustrations, automated Chapter-to-PDF compilation |
| **Cloud & Direct Files** | MediaFire, Google Drive, TeraBox, PixelDrain, GoFile, Mega.nz, Sfile.mobi, KrakenFiles | Direct binary link resolution, file size probing, & shortlink bypass (Linkvertise, LootLabs) |
| **Global Extractors** | **1,615+ Total Domains** | Powered by Tina Hybrid Core + `yt-dlp` global extractor registry |

---

## 7. REST API v1.4 Complete Specification

### 7.1 `POST /api/extract` — Extract Media & Stream List

Extracts metadata and direct download/streaming URLs from any supported URL.

- **Request Headers**:
  - `Content-Type: application/json`
  - `X-Device-ID: TINA-DEV-XXXX` *(optional, recommended for history & rate-limit bucket)*
- **Request Body**:
  ```json
  {
    "url": "https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "status": "ok",
    "data": {
      "title": "Mangu — Fourtwnty, Charita Utami",
      "author": "Fourtwnty, Charita Utami",
      "platform": "spotify",
      "extractorKey": "TinaCore::Spotify",
      "engine": "Tina Hybrid",
      "duration": "04:22",
      "uploadDate": "2022-04-20",
      "resolution": "320kbps HQ Full Audio",
      "acodec": "MP3 320kbps (44.1kHz)",
      "filesizeApprox": "10.6 MB",
      "thumbnail": "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273fecb2b49d97ed68528fbf44a",
      "webpageUrl": "https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ",
      "downloads": [
        {
          "id": "sp_0wULafSHeHYZFu54R9ZFRJ_full_320",
          "type": "audio",
          "quality": "Audio Full Track 320kbps · Mangu (MP3)",
          "ext": "mp3",
          "resolution": "320kbps",
          "filesizeFormatted": "10.6 MB",
          "url": "https://rapid.spotidown.app/v2?token=..."
        },
        {
          "id": "sp_0wULafSHeHYZFu54R9ZFRJ_cover",
          "type": "image",
          "quality": "Cover Artwork Resolusi Penuh (JPG)",
          "ext": "jpg",
          "resolution": "640x640 HD",
          "url": "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273fecb2b49d97ed68528fbf44a"
        }
      ]
    }
  }
  ```

### 7.2 Summary of All 7 API Endpoints

| Method | Endpoint Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/extract` | Primary media & metadata extractor across 1,615+ platforms. |
| `GET` | `/api/proxy-stream` | CORS & Referer-injected media streaming proxy with HTTP `206 Partial Content`. |
| `GET` | `/api/download/:filename` | Direct binary attachment download (`Content-Disposition: attachment`). |
| `POST` | `/api/resolve` | Resolves dynamic stream tokens (`spotidown_resolve:`, `applemusic_resolve:`) into direct URLs. |
| `POST` | `/api/compile-pdf` | Compiles an array of up to 60 image URLs into a single downloadable `.pdf` document. |
| `GET` | `/api/supported-sites` | Returns the complete list of 1,615+ supported platforms with search (`?q=`) & category filters. |
| `GET / DELETE` | `/api/history` | Lists or clears extraction history bound to the caller's IP and `X-Device-ID`. |

---

## 8. Multi-Language SDK Integration Examples

### 8.1 cURL

```bash
curl -X POST "https://tina-downloader.web.id/api/extract" \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: TINA-CLI-CLIENT" \
  -d '{"url": "https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ"}'
```

### 8.2 TypeScript / Fetch

```typescript
const response = await fetch("https://tina-downloader.web.id/api/extract", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Device-ID": "TINA-WEB-SDK",
  },
  body: JSON.stringify({
    url: "https://open.spotify.com/track/0wULafSHeHYZFu54R9ZFRJ",
  }),
});

const { data } = await response.json();
console.log(`${data.title} (${data.duration}) ->`, data.downloads[0].url);
```

### 8.3 Python 3 (`requests`)

```python
import requests

resp = requests.post(
    "https://tina-downloader.web.id/api/extract",
    json={"url": "https://youtu.be/Sgt6yH9UM-c?si=dUP74ef5pdgEShXX"},
    headers={"X-Device-ID": "TINA-PY-SDK"},
    timeout=30,
)
media = resp.json()["data"]
for stream in media["downloads"]:
    print(f"[{stream['ext'].upper()}] {stream['quality']} -> {stream['url']}")
```

---

## 9. Security, Rate Limiting & Device Fingerprinting

- **Dual-Identity Rate Limiting**: Powered by `server/go_worker.go` (and `api/security.go`), enforcing a sliding window of **15 extractions per 15 minutes** and a **burst cap of 5 requests per 20 seconds** per combined `(IP Address, X-Device-ID)` pair.
- **Silent Client Fingerprinting**: `src/utils/deviceFingerprint.ts` computes a deterministic, privacy-respecting hardware/canvas/audio-context hash stored in `localStorage` (`tina_device_id_v1`) without requiring user accounts or cookies.
- **SSRF & Header Sanitization**: All proxy and download endpoints validate `http(s)://` schemes, strip unsafe response headers, and enforce `X-Content-Type-Options: nosniff`.

---

## 10. Deployment Guide (Vercel, Docker & VPS)

### 10.1 Local Development & Full-Stack Production

```bash
# 1. Install Node.js dependencies
npm install

# 2. Start the full-stack development server on http://localhost:3000
npm run dev

# 3. Build frontend production bundle
npm run build

# 4. Run full-stack production server
npm start
```

### 10.2 Vercel Serverless Deployment

Tina Downloader is pre-configured for zero-config deployment on Vercel via `vercel.json`:
- All `/api/*` endpoints (`extract`, `proxy-stream`, `download`, `resolve`, `supported-sites`, `history`) are routed to the self-contained Python serverless gateway (`api/extract.py`).
- All SPA routes (`/history`, `/sites`, `/api-docs`, `/about`, `/developer`) rewrite cleanly to `/index.html` so refreshing or sharing deep links never triggers a 404 or resets the active tab.

---

## 11. Project Directory Structure

```text
├── api/
│   ├── extract.py                 # Vercel Python Serverless Gateway (Full-Track Spotify, TikWM, Piped, HTTP 206 Proxy)
│   └── security.go                # Go Serverless Security & Rate-Limit Handler
├── plugins/
│   └── siteMeta.ts                # Build-time SEO, OpenGraph, JSON-LD & Manifest Injector
├── public/
│   ├── assets/markdown/           # Bundled 1,615+ Supported Sites Registry
│   ├── avatar.jpg                 # Official Developer Avatar (Nimzz)
│   ├── banner.jpg                 # Official Developer Studio Banner
│   ├── logo.png                   # Tina Downloader Brand Mark
│   ├── readme.jpg                 # Repository Header Banner
│   └── thumbnail.jpg              # Hero Viewfinder Artwork
├── server/
│   ├── engines/
│   │   ├── mori-engine.js         # 45+ Native Platform Scrapers & PDF Generator
│   │   ├── tina-go-worker         # Compiled Go Rate-Limiter & Stream Header Prober
│   │   └── yt-dlp                 # Standalone Universal Extractor Binary
│   ├── go_worker.go               # Go Worker Source Code
│   └── py_engine.py               # Python yt-dlp Wrapper & SQLite3 WAL Persistence Engine
├── src/
│   ├── components/
│   │   ├── ApiDocsPage.tsx        # Interactive API Sandbox, Dual-Mode Inspector & 6-Language SDK Docs
│   │   ├── DeveloperPage.tsx      # Remade Editorial Developer Profile for Nimzz
│   │   └── V10MediaPlayer.tsx     # Custom HTML5 V10 Video Player & Full-Track Audio Deck
│   ├── utils/
│   │   ├── clientFallback.ts      # Safe JSON Fetcher, Bundled 1,615+ Sites Parser & Client Fallbacks
│   │   └── deviceFingerprint.ts   # Deterministic Device ID Generator
│   ├── App.tsx                    # Main Monochrome Studio SPA & Remade Archive History View
│   ├── index.css                  # Tailwind v4 Monochrome Design Tokens & Viewfinder Animations
│   └── types.ts                   # Shared TypeScript Interfaces
├── server.ts                      # Full-Stack Express + Vite + Tri-Engine Orchestrator
├── site.config.ts                 # Centralized Branding, Author & SEO Metadata Configuration
└── vercel.json                    # Vercel Serverless Routing & SPA Rewrite Rules
```

---

## 12. Troubleshooting & Engineering FAQ

- **Q: Why did audio previously stop at 29 seconds on some platforms, and how is it fixed?**  
  **A:** Public Spotify embeds only expose a 29-second preview (`p.scdn.co/mp3-preview`). Tina Downloader v10.5 resolves the full-length 320kbps master MP3 via SpotiDown (`rapid.spotidown.app/v2`) on both Node.js and Vercel Python, prioritizes it at `downloads[0]`, and streams it through `/api/proxy-stream` with `durationHint` synchronization.
- **Q: What happens if a user refreshes the browser on `/developer`, `/history`, or `/api-docs`?**  
  **A:** `resolveInitialActiveTab()` in `src/App.tsx` synchronizes the active tab with `window.location.pathname` (`pushState`/`popstate`) and `localStorage`, while `vercel.json` rewrites all non-file paths to `/index.html`. Refreshing always preserves your current page and last extracted media.

---

## 13. Developer Profile — Nimzz

<div align="center">

<img src="public/avatar.jpg" alt="Nimzz Avatar" width="96" style="border-radius: 16px;" />

### **Nimzz (`@NimzzAi`)**
**Lead Full-Stack Systems Engineer & Creator of Tina Downloader**  
*Indonesia*

| Platform | Handle | Official Link |
| :--- | :--- | :--- |
| **WhatsApp Channel** | Saluran Resmi Nimzz | [whatsapp.com/channel/0029VbBhZWdGJP8HlbGaE63Q](https://whatsapp.com/channel/0029VbBhZWdGJP8HlbGaE63Q) |
| **GitHub** | `@NimzzAi` | [github.com/NimzzAi](https://github.com/NimzzAi) |
| **Telegram** | `@Nimzz4` | [t.me/Nimzz4](https://t.me/Nimzz4) |
| **TikTok** | `@nimzz_bocil_pokemon` | [tiktok.com/@nimzz_bocil_pokemon](https://www.tiktok.com/@nimzz_bocil_pokemon) |

</div>

---

<div align="center">
  <sub>Copyright © 2026 <strong>Tina Downloader</strong> · Engineered with precision by <strong>Nimzz</strong>.</sub>
</div>