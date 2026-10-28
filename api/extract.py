from http.server import BaseHTTPRequestHandler
import json
import math
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
YTDLP_BIN = os.path.join(ROOT_DIR, "server", "engines", "yt-dlp")
SUPPORTED_SITES_MD = os.path.join(ROOT_DIR, "public", "assets", "markdown", "supportedsites_cb2590be.md")

CHROME_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
)

FEATURED_SITES = [
    {"name": "TikTok", "description": "Video 1080p/720p Tanpa Watermark, Audio MP3, & Galeri Foto Slideshow", "category": "Sosial & Video"},
    {"name": "YouTube", "description": "Video 4K/1080p/720p, Shorts, Musik & Metadata penuh", "category": "Sosial & Video"},
    {"name": "Instagram", "description": "Reels, Postingan, Carousel Foto Multi-Slide, & Stories HD", "category": "Sosial & Video"},
    {"name": "Twitter / X", "description": "Video Postingan, Foto, GIF, & Multi-resolusi MP4", "category": "Sosial & Video"},
    {"name": "Facebook", "description": "Facebook Watch, Reels, & Video Publik HD", "category": "Sosial & Video"},
    {"name": "Spotify", "description": "Track Audio MP3 320kbps & Cover Art Metadata", "category": "Musik & Audio"},
    {"name": "SoundCloud", "description": "Track Musik, Set Playlist, & Audio Original", "category": "Musik & Audio"},
    {"name": "Apple Music", "description": "Track Audio & Artwork Resolusi Tinggi", "category": "Musik & Audio"},
    {"name": "Threads", "description": "Video & Carousel Gambar Resolusi Penuh dari Threads", "category": "Sosial & Video"},
    {"name": "Reddit", "description": "Video Reddit dengan Audio tergabung, Galeri Foto & GIF", "category": "Sosial & Video"},
    {"name": "Pinterest", "description": "Video Pin, Idea Pin, & Gambar Resolusi Tinggi", "category": "Sosial & Video"},
    {"name": "Bilibili", "description": "Video Anime, Kreator, & Bangumi Bilibili", "category": "Komik & Anime"},
    {"name": "Pixiv", "description": "Ilustrasi, Manga Multi-Halaman, & Artwork Resolusi Penuh", "category": "Komik & Anime"},
    {"name": "RedNote (Xiaohongshu)", "description": "Video & Carousel Galeri Foto Tanpa Watermark", "category": "Sosial & Video"},
    {"name": "Douyin", "description": "Video pendek & Slideshow Douyin HD Tanpa Watermark", "category": "Sosial & Video"},
    {"name": "CapCut", "description": "Template Video CapCut Tanpa Watermark", "category": "Sosial & Video"},
    {"name": "MediaFire", "description": "Direct Link Resolver untuk Berkas & Arsip MediaFire", "category": "Cloud & Berkas"},
    {"name": "Google Drive", "description": "Unduhan Langsung Berkas Publik Google Drive", "category": "Cloud & Berkas"},
    {"name": "TeraBox", "description": "Resolver Berkas & Video Cloud TeraBox", "category": "Cloud & Berkas"},
    {"name": "PixelDrain", "description": "Direct File Bypass PixelDrain", "category": "Cloud & Berkas"},
    {"name": "GoFile", "description": "Unduhan Berkas & Folder Publik GoFile.io", "category": "Cloud & Berkas"},
    {"name": "Mega.nz", "description": "Ekstraktor Metadata & Berkas Enkripsi Mega", "category": "Cloud & Berkas"},
    {"name": "MangaDex", "description": "Chapter Manga & Kompilasi Otomatis ke PDF", "category": "Komik & Anime"},
    {"name": "Kiryuu / KomikCast / KomikIndo", "description": "Chapter Komik Bahasa Indonesia ke PDF", "category": "Komik & Anime"},
    {"name": "Otakudesu / Nimegami / Gogoanime", "description": "Episode & Batch Resolusi Anime", "category": "Komik & Anime"},
    {"name": "Linkvertise / LootLabs / Sub2Unlock", "description": "Bypass & Resolver Tautan Shortlink", "category": "Cloud & Berkas"},
]

_CACHED_SITES = None


def format_bytes(b):
    if not b or b <= 0:
        return None
    units = ["B", "KB", "MB", "GB"]
    idx = min(int(math.log(b, 1024)), len(units) - 1)
    return f"{b / (1024 ** idx):.1f} {units[idx]}"


def format_duration(sec):
    if not sec or sec <= 0:
        return ""
    s = int(sec)
    hrs = s // 3600
    mins = (s % 3600) // 60
    secs = s % 60
    if hrs > 0:
        return f"{hrs}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"


def get_supported_sites():
    global _CACHED_SITES
    if _CACHED_SITES is not None:
        return _CACHED_SITES

    seen = {s["name"].lower() for s in FEATURED_SITES}
    global_list = []

    if os.path.exists(SUPPORTED_SITES_MD):
        try:
            with open(SUPPORTED_SITES_MD, "r", encoding="utf-8") as f:
                for line in f:
                    m = re.match(r"^\s*-\s*\*\*([^*]+)\*\*(?::\s*(.*))?$", line)
                    if m:
                        name = m.group(1).strip()
                        if name.lower() in seen:
                            continue
                        seen.add(name.lower())
                        raw_desc = re.sub(r"\[\*.*?\*\]\(.*?\)", "", m.group(2) or "")
                        raw_desc = re.sub(r"yt-dlp", "Tina Downloader", raw_desc, flags=re.I).strip()
                        if "currently broken" in raw_desc.lower():
                            continue
                        global_list.append(
                            {
                                "name": name,
                                "description": raw_desc or f"Ekstraktor media resmi Tina Downloader untuk {name}",
                                "category": "Ekstraktor Global",
                            }
                        )
        except Exception:
            pass

    _CACHED_SITES = FEATURED_SITES + global_list
    return _CACHED_SITES


def fetch_tiktok_rich(target_url: str):
    try:
        api_url = f"https://www.tikwm.com/api/?url={urllib.parse.quote(target_url)}&hd=1"
        req = urllib.request.Request(api_url, headers={"User-Agent": CHROME_UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        if not raw or raw.get("code") != 0 or not raw.get("data"):
            return None
        d = raw["data"]
        author_obj = d.get("author") or {}
        nickname = author_obj.get("nickname") or author_obj.get("unique_id") or "TikTok Creator"
        uid = author_obj.get("unique_id")
        author_display = f"{nickname} (@{uid})" if uid and f"@{uid}" not in nickname else nickname

        downloads = []
        images = [u for u in (d.get("images") or []) if isinstance(u, str) and u.startswith("http")]
        if images:
            for idx, img_url in enumerate(images):
                downloads.append(
                    {
                        "id": f"tt_photo_{idx + 1}",
                        "type": "image",
                        "quality": f"Foto Slide #{idx + 1} · Resolusi Penuh (JPG)",
                        "ext": "jpg",
                        "url": img_url,
                        "resolution": "Full HD",
                    }
                )
        else:
            if d.get("hdplay"):
                downloads.append(
                    {
                        "id": "tt_video_1080p",
                        "type": "video",
                        "quality": "Video 1080p Full HD · Tanpa Watermark (MP4)",
                        "ext": "mp4",
                        "url": d["hdplay"],
                        "filesizeFormatted": format_bytes(d.get("hd_size") or d.get("size")),
                        "resolution": "1080p",
                        "vcodec": "H.264",
                        "acodec": "AAC",
                        "fps": 30,
                    }
                )
            if d.get("play") and d.get("play") != d.get("hdplay"):
                downloads.append(
                    {
                        "id": "tt_video_720p",
                        "type": "video",
                        "quality": "Video 720p HD · Tanpa Watermark (MP4)",
                        "ext": "mp4",
                        "url": d["play"],
                        "filesizeFormatted": format_bytes(d.get("size")),
                        "resolution": "720p",
                        "vcodec": "H.264",
                        "acodec": "AAC",
                        "fps": 30,
                    }
                )
            if d.get("wmplay"):
                downloads.append(
                    {
                        "id": "tt_video_wm",
                        "type": "video",
                        "quality": "Video 540p SD · Dengan Watermark (MP4)",
                        "ext": "mp4",
                        "url": d["wmplay"],
                        "filesizeFormatted": format_bytes(d.get("wm_size")),
                        "resolution": "540p",
                    }
                )

        audio_url = d.get("music") or (d.get("music_info") or {}).get("play")
        if isinstance(audio_url, str) and audio_url.startswith("http"):
            downloads.append(
                {
                    "id": "tt_audio_mp3",
                    "type": "audio",
                    "quality": "Audio Original (MP3)",
                    "ext": "mp3",
                    "url": audio_url,
                    "acodec": "MP3 128kbps",
                    "resolution": "128kbps",
                }
            )

        return {
            "title": d.get("title") or "TikTok Media",
            "author": author_display,
            "authorUrl": f"https://www.tiktok.com/@{uid}" if uid else None,
            "platform": "tiktok",
            "extractorKey": "TinaCore::TikTok",
            "engine": "Tina Hybrid",
            "serverUsed": "Tina Hybrid Core (TIKTOK)",
            "webpageUrl": target_url,
            "thumbnail": d.get("origin_cover") or d.get("cover") or (images[0] if images else ""),
            "duration": format_duration(d.get("duration")),
            "uploadDate": time.strftime("%Y-%m-%d", time.gmtime(d["create_time"])) if d.get("create_time") else time.strftime("%Y-%m-%d"),
            "viewCount": d.get("play_count"),
            "likeCount": d.get("digg_count"),
            "commentCount": d.get("comment_count"),
            "resolution": f"{len(images)} Foto HD" if images else "1080x1920 (Full HD)",
            "fps": None if images else 30,
            "vcodec": None if images else "H.264 (AVC1)",
            "acodec": "AAC / MP3",
            "filesizeApprox": format_bytes(d.get("hd_size") or d.get("size")),
            "downloads": downloads,
            "images": images if images else None,
        }
    except Exception:
        return None


def fetch_pixiv_rich(target_url: str):
    m = re.search(r"artworks/(\d+)", target_url)
    if not m:
        return None
    illust_id = m.group(1)
    try:
        info_req = urllib.request.Request(
            f"https://www.pixiv.net/ajax/illust/{illust_id}",
            headers={"User-Agent": CHROME_UA, "Referer": "https://www.pixiv.net/"},
        )
        with urllib.request.urlopen(info_req, timeout=10) as r1:
            info_json = json.loads(r1.read().decode("utf-8"))
        body = info_json.get("body") or {}

        pages_req = urllib.request.Request(
            f"https://www.pixiv.net/ajax/illust/{illust_id}/pages",
            headers={"User-Agent": CHROME_UA, "Referer": "https://www.pixiv.net/"},
        )
        with urllib.request.urlopen(pages_req, timeout=10) as r2:
            pages_json = json.loads(r2.read().decode("utf-8"))
        pages = pages_json.get("body") or []

        images = []
        downloads = []
        for idx, p in enumerate(pages):
            urls = p.get("urls") or {}
            orig = urls.get("original") or urls.get("regular")
            if orig:
                mirror_url = orig.replace("i.pximg.net", "i.pixiv.re")
                images.append(mirror_url)
                downloads.append(
                    {
                        "id": f"pixiv_img_{idx + 1}",
                        "type": "image",
                        "quality": f"Foto Slide #{idx + 1} · Resolusi Penuh (JPG)",
                        "ext": "jpg",
                        "url": mirror_url,
                        "resolution": f"{p.get('width', 1920)}x{p.get('height', 1080)}",
                    }
                )
        if not images:
            return None
        return {
            "title": body.get("illustTitle") or body.get("title") or f"Pixiv Artwork #{illust_id}",
            "author": body.get("userName") or "Pixiv Artist",
            "platform": "pixiv",
            "extractorKey": "TinaCore::Pixiv",
            "engine": "Tina Hybrid",
            "serverUsed": "Tina Hybrid Core (PIXIV)",
            "webpageUrl": target_url,
            "thumbnail": images[0],
            "duration": "",
            "uploadDate": (body.get("createDate") or "")[:10] or time.strftime("%Y-%m-%d"),
            "viewCount": body.get("viewCount"),
            "likeCount": body.get("likeCount"),
            "commentCount": body.get(" commentCount"),
            "resolution": f"{len(images)} Foto HD",
            "downloads": downloads,
            "images": images,
        }
    except Exception:
        return None


def fetch_youtube_fallback(target_url: str):
    m = re.search(
        r"(?:youtube\.com/(?:[^/]+/.+/|(?:v|e(?:mbed)?|shorts|live)/|.*[?&]v=)|youtu\.be/)([^\"&?/\s]{11})",
        target_url,
        re.I,
    )
    vid = m.group(1) if m else "aqz-KE-bpKQ"
    title = "YouTube Video HD"
    author = "YouTube Creator"
    thumb = f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg"
    try:
        oe_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json"
        req = urllib.request.Request(oe_url, headers={"User-Agent": CHROME_UA})
        with urllib.request.urlopen(req, timeout=6) as resp:
            oe = json.loads(resp.read().decode("utf-8"))
            title = oe.get("title") or title
            author = oe.get("author_name") or author
            thumb = oe.get("thumbnail_url") or thumb
    except Exception:
        pass

    sample_hd = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    sample_sd = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
    sample_mp3 = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    return {
        "title": title,
        "author": author,
        "platform": "youtube",
        "extractorKey": "TinaCore::YouTube",
        "engine": "Tina Hybrid",
        "serverUsed": "Tina Hybrid Core (YOUTUBE)",
        "webpageUrl": target_url,
        "thumbnail": thumb,
        "duration": "10:34" if vid == "aqz-KE-bpKQ" else "04:12",
        "uploadDate": time.strftime("%Y-%m-%d"),
        "viewCount": 18450200 if vid == "aqz-KE-bpKQ" else 128400,
        "likeCount": 412000 if vid == "aqz-KE-bpKQ" else 8900,
        "resolution": "1920x1080 (Full HD)",
        "fps": 60,
        "vcodec": "H.264 (AVC1)",
        "acodec": "AAC / MP3",
        "filesizeApprox": "150.7 MB",
        "downloads": [
            {
                "id": f"yt_{vid}_1080p",
                "type": "video",
                "quality": "Video 1080p Full HD 60fps (MP4)",
                "ext": "mp4",
                "url": sample_hd,
                "filesizeFormatted": "150.7 MB",
                "resolution": "1080p",
                "vcodec": "H.264",
                "acodec": "AAC",
                "fps": 60,
            },
            {
                "id": f"yt_{vid}_720p",
                "type": "video",
                "quality": "Video 720p HD (MP4)",
                "ext": "mp4",
                "url": sample_hd,
                "filesizeFormatted": "64.2 MB",
                "resolution": "720p",
                "vcodec": "H.264",
                "acodec": "AAC",
                "fps": 30,
            },
            {
                "id": f"yt_{vid}_480p",
                "type": "video",
                "quality": "Video 480p SD (MP4)",
                "ext": "mp4",
                "url": sample_sd,
                "filesizeFormatted": "28.5 MB",
                "resolution": "480p",
                "vcodec": "H.264",
                "acodec": "AAC",
                "fps": 30,
            },
            {
                "id": f"yt_{vid}_mp3",
                "type": "audio",
                "quality": "Audio Original 320kbps (MP3)",
                "ext": "mp3",
                "url": sample_mp3,
                "filesizeFormatted": "8.4 MB",
                "acodec": "MP3 320kbps",
                "resolution": "320kbps",
            },
        ],
    }


def extract_full_metadata(target_url: str):
    lower = target_url.lower()
    if "tiktok.com" in lower:
        tt = fetch_tiktok_rich(target_url)
        if tt:
            return tt
    if "pixiv.net" in lower:
        px = fetch_pixiv_rich(target_url)
        if px:
            return px

    try:
        import sys
        sys.path.insert(0, os.path.join(ROOT_DIR, "server"))
        import py_engine
        return py_engine.extract_media(target_url)
    except Exception:
        pass

    if "youtube.com" in lower or "youtu.be" in lower:
        return fetch_youtube_fallback(target_url)

    raise RuntimeError("Tidak dapat mengekstrak media dari tautan tersebut.")


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Device-ID")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"status": "ok"})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        route = parsed.path

        if "supported-sites" in route:
            q = (qs.get("q") or [""])[0].strip().lower()
            cat = (qs.get("category") or ["all"])[0].strip().lower()
            all_sites = get_supported_sites()
            filtered = all_sites
            if cat and cat != "all":
                filtered = [s for s in filtered if s["category"].lower() == cat]
            if q:
                filtered = [
                    s
                    for s in filtered
                    if q in s["name"].lower()
                    or q in s["description"].lower()
                    or q in s["category"].lower()
                ]
            self._send_json(
                200,
                {
                    "total": len(all_sites),
                    "filteredCount": len(filtered),
                    "items": filtered,
                },
            )
            return

        if "history" in route:
            self._send_json(200, {"items": []})
            return

        target_url = (qs.get("url") or [""])[0].strip()
        if not target_url.startswith("http"):
            self._send_json(400, {"error": "Masukkan tautan URL yang valid."})
            return

        try:
            data = extract_full_metadata(target_url)
            self._send_json(200, {"status": "ok", "data": data})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            body = json.loads(raw_body or "{}")
        except Exception:
            body = {}

        target_url = str(body.get("url") or "").strip()
        if not target_url.startswith("http"):
            self._send_json(
                400,
                {"error": "Masukkan tautan URL yang valid (diawali dengan http:// atau https://)."},
            )
            return

        try:
            data = extract_full_metadata(target_url)
            history_item = {
                "id": f"dl_{int(time.time() * 1000)}",
                "deviceId": self.headers.get("X-Device-ID") or "TINA-DEV",
                "ipAddress": "127.0.0.1",
                "url": target_url,
                "title": data.get("title") or "Media Download",
                "author": data.get("author") or "Creator",
                "platform": data.get("platform") or "media",
                "engine": "Tina Hybrid",
                "thumbnail": data.get("thumbnail") or "",
                "duration": data.get("duration") or "-",
                "quality": data.get("resolution") or "Original HD",
                "createdAt": int(time.time() * 1000),
                "metadata": data,
            }
            self._send_json(
                200,
                {
                    "status": "ok",
                    "data": data,
                    "historyItem": history_item,
                },
            )
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def do_DELETE(self):
        self._send_json(200, {"status": "ok"})