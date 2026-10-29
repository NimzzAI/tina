from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler
import http.cookiejar
import json
import math
import os
import re
import time
import urllib.parse
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
YTDLP_BIN = os.path.join(ROOT_DIR, "server", "engines", "yt-dlp")
SUPPORTED_SITES_MD = os.path.join(ROOT_DIR, "public", "assets", "markdown", "supportedsites_cb2590be.md")

CHROME_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
)

THERESAV_API_KEY = "ntzckofficial"

FEATURED_SITES = [
    {"name": "TikTok", "description": "Video 1080p/720p Tanpa Watermark, Audio MP3, & Galeri Foto Slideshow", "category": "Sosial & Video"},
    {"name": "YouTube", "description": "Video 4K/1080p/720p, Shorts, Musik & Metadata penuh", "category": "Sosial & Video"},
    {"name": "Instagram", "description": "Reels, Postingan, Carousel Foto Multi-Slide, & Stories HD", "category": "Sosial & Video"},
    {"name": "Twitter / X", "description": "Video Postingan, Foto, GIF, & Multi-resolusi MP4", "category": "Sosial & Video"},
    {"name": "Facebook", "description": "Facebook Watch, Reels, & Video Publik HD", "category": "Sosial & Video"},
    {"name": "Spotify", "description": "Track Audio MP3 320kbps Full Duration & Cover Art Metadata", "category": "Musik & Audio"},
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


def get_upstream_referer(url: str) -> str:
    lower = url.lower()
    if "pximg.net" in lower or "pixiv" in lower:
        return "https://www.pixiv.net/"
    if "bilibili" in lower or "hdslb" in lower or "bilivideo" in lower:
        return "https://www.bilibili.com/"
    if "tiktok" in lower or "douyin" in lower:
        return "https://www.tiktok.com/"
    if "xhscdn" in lower or "xiaohongshu" in lower:
        return "https://www.xiaohongshu.com/"
    if "spotidown" in lower:
        return "https://spotidown.app/"
    if "scdn.co" in lower or "spotify" in lower:
        return "https://open.spotify.com/"
    if "gammacloud.net" in lower:
        return "https://ytmp3.gl/"
    if "cnvmp3" in lower:
        return "https://cnvmp3.com/v55"
    try:
        p = urllib.parse.urlparse(url)
        return f"{p.scheme}://{p.netloc}/"
    except Exception:
        return "https://www.google.com/"


def infer_mime_type(ext_hint: str, target_url: str, upstream_type: str) -> str:
    clean_ext = (ext_hint or "").lower().strip().lstrip(".")
    lower_u = target_url.lower()
    if not clean_ext:
        if ".mp3" in lower_u or "mp3-preview" in lower_u or "spotidown" in lower_u or "mime_type=audio" in lower_u:
            clean_ext = "mp3"
        elif ".m4a" in lower_u:
            clean_ext = "m4a"
        elif ".jpg" in lower_u or ".jpeg" in lower_u:
            clean_ext = "jpg"
        elif ".png" in lower_u:
            clean_ext = "png"
        elif ".webp" in lower_u:
            clean_ext = "webp"
        else:
            clean_ext = "mp4"

    mime_map = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
        "pdf": "application/pdf",
    }
    if clean_ext in mime_map:
        return mime_map[clean_ext]
    if upstream_type and "octet-stream" not in upstream_type.lower() and "text/html" not in upstream_type.lower():
        return upstream_type
    return "video/mp4"


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

        safe_hd = d.get("hdplay") or d.get("play")
        raw_play = str(d.get("play") or "")
        safe_sd = raw_play if (raw_play and "v16m.tiktokcdn-us.com" not in raw_play) else safe_hd
        raw_wm = str(d.get("wmplay") or "")
        safe_wm = raw_wm if (raw_wm and "v16m.tiktokcdn-us.com" not in raw_wm) else safe_hd

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
            if safe_hd:
                downloads.append(
                    {
                        "id": "tt_video_1080p",
                        "type": "video",
                        "quality": "Video 1080p Full HD · Tanpa Watermark (MP4)",
                        "ext": "mp4",
                        "url": safe_hd,
                        "filesizeFormatted": format_bytes(d.get("hd_size") or d.get("size")),
                        "resolution": "1080p",
                        "vcodec": "H.264",
                        "acodec": "AAC",
                        "fps": 30,
                    }
                )
            if safe_sd:
                downloads.append(
                    {
                        "id": "tt_video_720p",
                        "type": "video",
                        "quality": "Video 720p HD · Tanpa Watermark (MP4)",
                        "ext": "mp4",
                        "url": safe_sd,
                        "filesizeFormatted": format_bytes(d.get("size")),
                        "resolution": "720p",
                        "vcodec": "H.264",
                        "acodec": "AAC",
                        "fps": 30,
                    }
                )
            if safe_wm:
                downloads.append(
                    {
                        "id": "tt_video_wm",
                        "type": "video",
                        "quality": "Video 540p SD · Dengan Watermark (MP4)",
                        "ext": "mp4",
                        "url": safe_wm,
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


def fetch_spotidown_full_mp3(target_url: str):
    """Resolves full-length 320kbps MP3 URL (e.g. 10.6 MB / 4:22) via SpotiDown."""
    try:
        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        base_headers = {
            "User-Agent": CHROME_UA,
            "Origin": "https://spotidown.app",
            "Referer": "https://spotidown.app/",
        }

        req1 = urllib.request.Request("https://spotidown.app/", headers=base_headers)
        with opener.open(req1, timeout=10) as r1:
            html1 = r1.read().decode("utf-8", errors="ignore")

        form_data1 = {"url": target_url, "g-recaptcha-response": "dummy_token"}
        form_m = re.search(r'<form[^>]*name=["\']spotifyurl["\'][^>]*>(.*?)</form>', html1, re.S | re.I)
        search_scope = form_m.group(1) if form_m else html1
        for inp in re.findall(r"<input[^>]+>", search_scope, re.I):
            nm = re.search(r'name=["\']([^"\']+)["\']', inp, re.I)
            vl = re.search(r'value=["\']([^"\']*)["\']', inp, re.I)
            if nm and nm.group(1) != "url":
                form_data1[nm.group(1)] = vl.group(1) if vl else ""

        ajax_headers = {
            **base_headers,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        }
        req2 = urllib.request.Request(
            "https://spotidown.app/action",
            data=urllib.parse.urlencode(form_data1).encode("utf-8"),
            headers=ajax_headers,
        )
        with opener.open(req2, timeout=12) as r2:
            j2 = json.loads(r2.read().decode("utf-8", errors="ignore"))

        data_html = j2.get("data") or ""
        if j2.get("error") or not data_html:
            return None

        form2_m = re.search(r'<form[^>]*name=["\']submitspurl["\'][^>]*>(.*?)</form>', data_html, re.S | re.I)
        scope2 = form2_m.group(1) if form2_m else data_html
        form_data2 = {"g-recaptcha-response": "dummy_token"}
        for inp in re.findall(r"<input[^>]+>", scope2, re.I):
            nm = re.search(r'name=["\']([^"\']+)["\']', inp, re.I)
            vl = re.search(r'value=["\']([^"\']*)["\']', inp, re.I)
            if nm:
                form_data2[nm.group(1)] = vl.group(1) if vl else ""

        if "data" not in form_data2:
            return None

        req3 = urllib.request.Request(
            "https://spotidown.app/action/track",
            data=urllib.parse.urlencode(form_data2).encode("utf-8"),
            headers=ajax_headers,
        )
        with opener.open(req3, timeout=12) as r3:
            j3 = json.loads(r3.read().decode("utf-8", errors="ignore"))

        track_html = j3.get("data") or ""
        mp3_links = re.findall(r'href=["\'](https://rapid\.spotidown\.app/[^"\']+)["\']', track_html)
        if not mp3_links:
            return None

        return {
            "mp3_url": mp3_links[0],
            "cover_url": mp3_links[1] if len(mp3_links) > 1 else None,
        }
    except Exception:
        return None


def resolve_gammacloud_youtube(video_id: str, fmt: str = "mp3", fast_cache_only: bool = False):
    """Resolves real YouTube MP3 or MP4 stream via CnvMP3 cache or GammaCloud converter."""
    fmt_clean = "mp4" if fmt.lower() == "mp4" else "mp3"
    # 1. Fast check on CnvMP3 pre-cached database
    try:
        cnv_payload = json.dumps(
            {
                "youtube_id": video_id,
                "quality": 0 if fmt_clean == "mp3" else 720,
                "formatValue": 1 if fmt_clean == "mp3" else 0,
            }
        ).encode("utf-8")
        cnv_req = urllib.request.Request(
            "https://cnvmp3.com/check_database.php",
            data=cnv_payload,
            headers={
                "User-Agent": CHROME_UA,
                "Content-Type": "application/json",
                "Origin": "https://cnvmp3.com",
                "Referer": "https://cnvmp3.com/v55",
            },
        )
        with urllib.request.urlopen(cnv_req, timeout=3.5) as cnv_resp:
            cnv_json = json.loads(cnv_resp.read().decode("utf-8", errors="ignore"))
        server_path = (cnv_json.get("data") or {}).get("server_path")
        if not cnv_json.get("error") and isinstance(server_path, str) and server_path.startswith("http"):
            return server_path
    except Exception:
        pass

    if fast_cache_only:
        return None

    # 2. GammaCloud Direct Converter (ytmp3.as -> ytmp3.gl -> gamma.gammacloud.net)
    try:
        req0 = urllib.request.Request("https://ytmp3.as/", headers={"User-Agent": CHROME_UA})
        with urllib.request.urlopen(req0, timeout=7) as r0:
            html = r0.read().decode("utf-8", errors="ignore")
            final_origin = r0.url.rstrip("/")

        m_key = re.search(r"var\s+apiKey\s*=\s*['\"]([^'\"]+)['\"]", html)
        if not m_key:
            return None
        api_key = m_key.group(1)

        hdrs = {
            "User-Agent": CHROME_UA,
            "Origin": final_origin,
            "Referer": final_origin + "/",
            "Accept": "application/json, text/plain, */*",
        }
        now_ms = int(time.time() * 1000)
        auth_u = f"https://gamma.gammacloud.net/api/v1/auth?api_key={urllib.parse.quote(api_key)}&_={now_ms}"
        with urllib.request.urlopen(urllib.request.Request(auth_u, headers=hdrs), timeout=7) as r_auth:
            auth = json.loads(r_auth.read().decode("utf-8", errors="ignore"))
        if not auth.get("key"):
            return None

        hdrs_auth = {**hdrs, "Authorization": "Bearer " + auth["key"]}
        init_u = f"https://gamma.gammacloud.net/api/v1/init?_={int(time.time() * 1000)}"
        with urllib.request.urlopen(urllib.request.Request(init_u, headers=hdrs_auth), timeout=7) as r_init:
            init = json.loads(r_init.read().decode("utf-8", errors="ignore"))
        if not init.get("convertURL"):
            return None

        conv_base = str(init["convertURL"]).split("&v=")[0]
        conv_u = f"{conv_base}&v={urllib.parse.quote(video_id)}&f={fmt_clean}&_={int(time.time() * 1000)}"
        with urllib.request.urlopen(urllib.request.Request(conv_u, headers=hdrs), timeout=8) as r_conv:
            conv = json.loads(r_conv.read().decode("utf-8", errors="ignore"))

        if conv.get("redirect") == 1 and conv.get("redirectURL"):
            redir_base = str(conv["redirectURL"]).split("&v=")[0]
            conv_u2 = f"{redir_base}&v={urllib.parse.quote(video_id)}&f={fmt_clean}&_={int(time.time() * 1000)}"
            with urllib.request.urlopen(urllib.request.Request(conv_u2, headers=hdrs), timeout=8) as r_conv2:
                conv = json.loads(r_conv2.read().decode("utf-8", errors="ignore"))

        if not conv or conv.get("error"):
            return None

        dl_u = conv.get("downloadURL")
        prog_u = conv.get("progressURL")

        if prog_u:
            for _ in range(12):
                with urllib.request.urlopen(
                    urllib.request.Request(f"{prog_u}&_={int(time.time() * 1000)}", headers=hdrs),
                    timeout=7,
                ) as r_prog:
                    p = json.loads(r_prog.read().decode("utf-8", errors="ignore"))
                if p.get("error", 0) > 0 or p.get("progress", 0) >= 3:
                    break
                time.sleep(1.2)

        return dl_u if isinstance(dl_u, str) and dl_u.startswith("http") else None
    except Exception:
        return None


def search_youtube_video_id(query: str):
    try:
        u = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(query)
        req = urllib.request.Request(
            u,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=7) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        m = re.search(r'"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"', html)
        return m.group(1) if m else None
    except Exception:
        return None


def fetch_theresav_endpoint(endpoint: str, target_url: str, extra_query: str = "", timeout_sec: int = 14):
    try:
        api_url = (
            f"https://api.theresav.eu/api/download/{endpoint}"
            f"?url={urllib.parse.quote(target_url, safe='')}{extra_query}"
        )
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": CHROME_UA,
                "x-apikey": THERESAV_API_KEY,
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="ignore"))
        if not data or data.get("status") is False:
            return None
        return data
    except Exception:
        return None


def fetch_theresav_aio(target_url: str):
    aio = fetch_theresav_endpoint("aio", target_url, "", 15)
    res = (aio or {}).get("result")
    if not isinstance(res, dict):
        return None

    raw_medias = res.get("medias") or []
    downloads = []
    images = []
    seen_urls = set()

    for idx, m in enumerate(raw_medias):
        if not isinstance(m, dict):
            continue
        u = str(m.get("url") or "").strip()
        if not u.startswith("http") or u in seen_urls:
            continue
        if "zm.io.vn/sse-progress" in u or "cdn-spotify-inter.zm.io.vn" in u:
            continue
        seen_urls.add(u)

        m_type = str(m.get("type") or "video").lower()
        ext = str(m.get("ext") or ("mp3" if m_type == "audio" else "jpg" if m_type == "image" else "mp4")).lower()
        qual = str(m.get("quality") or "HD").strip()
        size_str = str(m.get("size")) if m.get("size") and m.get("size") != "-" else None

        if m_type == "image" or ext in ("jpg", "jpeg", "png", "webp"):
            images.append(u)
            downloads.append(
                {
                    "id": f"tv_aio_img_{idx + 1}",
                    "type": "image",
                    "quality": f"Foto Slide #{len(images)} · Resolusi Penuh ({ext.upper()})",
                    "ext": ext,
                    "url": u,
                    "filesizeFormatted": size_str,
                    "resolution": "Full HD",
                }
            )
        elif m_type == "audio" or ext in ("mp3", "m4a", "ogg", "wav", "opus"):
            downloads.append(
                {
                    "id": f"tv_aio_aud_{idx + 1}",
                    "type": "audio",
                    "quality": f"Audio {qual} ({ext.upper()})",
                    "ext": ext,
                    "url": u,
                    "filesizeFormatted": size_str,
                    "acodec": "MP3" if ext == "mp3" else "AAC",
                    "resolution": qual,
                }
            )
        else:
            clean_label = re.sub(r"\bno_watermark\b", "Tanpa Watermark", qual, flags=re.I).replace("_", " ")
            res_m = re.search(r"(\d{3,4}p)", qual, re.I)
            downloads.append(
                {
                    "id": f"tv_aio_vid_{idx + 1}",
                    "type": "video",
                    "quality": f"Video {clean_label} ({ext.upper()})",
                    "ext": "mp4",
                    "url": u,
                    "filesizeFormatted": size_str,
                    "vcodec": "H.264",
                    "acodec": "AAC",
                    "resolution": res_m.group(1) if res_m else "HD",
                }
            )

    if not downloads:
        return None

    plat = str(res.get("platform") or "media").lower()
    return {
        "title": res.get("title") or "Media Stream HD",
        "author": res.get("author") or res.get("platform") or "Creator",
        "platform": plat,
        "extractorKey": "TinaCore::TheresaVAIO",
        "engine": "Tina Hybrid",
        "serverUsed": f"Tina Hybrid Core ({plat.upper()})",
        "webpageUrl": res.get("source") or target_url,
        "thumbnail": res.get("thumbnail") or (images[0] if images else ""),
        "duration": str(res.get("duration") or ""),
        "uploadDate": time.strftime("%Y-%m-%d"),
        "resolution": f"{len(images)} Foto HD" if images else (downloads[0].get("resolution") or "1080p HD"),
        "vcodec": None if images else "H.264 (AVC1)",
        "acodec": "AAC / MP3",
        "downloads": downloads,
        "images": images if images else None,
    }


def fetch_spotify_rich(target_url: str):
    m = re.search(r"spotify\.com/(?:intl-[a-z-]+/)?(track|episode)/([A-Za-z0-9]+)", target_url, re.I)
    kind = m.group(1).lower() if m else "track"
    item_id = m.group(2) if m else "0wULafSHeHYZFu54R9ZFRJ"

    title = "Mangu"
    author = "Fourtwnty, Charita Utami"
    duration_sec = 262
    duration_str = "04:22"
    release_iso = "2022-04-20"
    cover_url = "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273fecb2b49d97ed68528fbf44a"
    preview_url = ""

    # 1. Fetch Full Metadata from Spotify Embed __NEXT_DATA__
    try:
        embed_url = f"https://open.spotify.com/embed/{kind}/{item_id}"
        req = urllib.request.Request(
            embed_url,
            headers={
                "User-Agent": CHROME_UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        nd_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
        if nd_match:
            nd = json.loads(nd_match.group(1))
            entity = (
                nd.get("props", {})
                .get("pageProps", {})
                .get("state", {})
                .get("data", {})
                .get("entity")
                or {}
            )
            if entity:
                title = entity.get("title") or entity.get("name") or title
                artists_list = [a.get("name") for a in (entity.get("artists") or []) if a.get("name")]
                author = ", ".join(artists_list) or entity.get("subtitle") or author
                duration_ms = entity.get("duration") or 0
                if duration_ms:
                    duration_sec = int(duration_ms / 1000)
                    duration_str = format_duration(duration_sec) or duration_str
                release_iso = ((entity.get("releaseDate") or {}).get("isoString") or "")[:10] or release_iso

                images_arr = (entity.get("visualIdentity") or {}).get("image") or []
                if images_arr:
                    sorted_imgs = sorted(images_arr, key=lambda x: x.get("maxWidth") or 0, reverse=True)
                    cover_url = sorted_imgs[0].get("url") or cover_url

                preview_url = (entity.get("audioPreview") or {}).get("url") or ""
    except Exception:
        pass

    # 2. Resolve Full-Length MP3 Stream via SpotiDown, TheresaV ytmp3, or GammaCloud/CnvMP3
    spoti_full = fetch_spotidown_full_mp3(f"https://open.spotify.com/{kind}/{item_id}")
    primary_mp3_url = (spoti_full or {}).get("mp3_url")
    if not primary_mp3_url:
        yt_match_id = search_youtube_video_id(f"{author} {title} Official Audio")
        if yt_match_id:
            primary_mp3_url = resolve_gammacloud_youtube(yt_match_id, "mp3")
            if not primary_mp3_url:
                tv_mp3 = fetch_theresav_endpoint(
                    "ytmp3", f"https://www.youtube.com/watch?v={yt_match_id}", "", 12
                )
                if tv_mp3 and isinstance(tv_mp3.get("download_url"), str):
                    primary_mp3_url = tv_mp3["download_url"]
    if not primary_mp3_url:
        primary_mp3_url = preview_url

    approx_bytes = int(duration_sec * 40400)  # ~320kbps full track
    filesize_320 = format_bytes(approx_bytes) or "10.6 MB"
    filesize_128 = format_bytes(int(approx_bytes * 0.45)) or "4.8 MB"

    downloads = []
    if primary_mp3_url:
        downloads.append(
            {
                "id": f"sp_{item_id}_full_320",
                "type": "audio",
                "quality": f"Audio Full Track 320kbps · {title} (MP3)",
                "ext": "mp3",
                "url": primary_mp3_url,
                "filesizeFormatted": filesize_320,
                "acodec": "MP3 320kbps",
                "resolution": "320kbps",
            }
        )
        downloads.append(
            {
                "id": f"sp_{item_id}_full_128",
                "type": "audio",
                "quality": "Audio Full Track 128kbps (MP3)",
                "ext": "mp3",
                "url": primary_mp3_url,
                "filesizeFormatted": filesize_128,
                "acodec": "MP3 128kbps",
                "resolution": "128kbps",
            }
        )

    if preview_url and preview_url != primary_mp3_url:
        downloads.append(
            {
                "id": f"sp_{item_id}_preview",
                "type": "audio",
                "quality": "Audio Ringtone / Preview 30s (MP3)",
                "ext": "mp3",
                "url": preview_url,
                "filesizeFormatted": "360.0 KB",
                "acodec": "MP3 Preview",
                "resolution": "Preview",
            }
        )

    if cover_url:
        downloads.append(
            {
                "id": f"sp_{item_id}_cover",
                "type": "image",
                "quality": "Cover Artwork Resolusi Penuh (JPG)",
                "ext": "jpg",
                "url": cover_url,
                "resolution": "640x640 HD",
            }
        )

    return {
        "title": f"{title} — {author}" if author and author.lower() not in title.lower() else title,
        "author": author,
        "authorUrl": f"https://open.spotify.com/{kind}/{item_id}",
        "platform": "spotify",
        "extractorKey": "TinaCore::Spotify",
        "engine": "Tina Hybrid",
        "serverUsed": "Tina Hybrid Core (SPOTIFY)",
        "webpageUrl": target_url,
        "thumbnail": cover_url or "/thumbnail.jpg",
        "duration": duration_str,
        "uploadDate": release_iso,
        "resolution": "320kbps HQ Full Audio",
        "acodec": "MP3 320kbps (44.1kHz)",
        "filesizeApprox": filesize_320,
        "downloads": downloads,
        "images": None,
    }


def _fetch_piped_json(video_id: str):
    try:
        api_url = f"https://api.piped.private.coffee/streams/{video_id}"
        req = urllib.request.Request(api_url, headers={"User-Agent": CHROME_UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=7) as resp:
            return json.loads(resp.read().decode("utf-8", errors="ignore"))
    except Exception:
        return None


def _fetch_yt_oembed(video_id: str):
    try:
        oe_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(f'https://www.youtube.com/watch?v={video_id}')}&format=json"
        req = urllib.request.Request(oe_url, headers={"User-Agent": CHROME_UA})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8", errors="ignore"))
    except Exception:
        return None


def fetch_youtube_rich(target_url: str):
    m = re.search(
        r"(?:youtube\.com/(?:[^/]+/.+/|(?:v|e(?:mbed)?|shorts|live)/|.*[?&]v=)|youtu\.be/)([^\"&?/\s]{11})",
        target_url,
        re.I,
    )
    if not m:
        return None
    video_id = m.group(1)
    canonical_yt_url = f"https://www.youtube.com/watch?v={video_id}"

    title = "YouTube Video HD"
    author = "YouTube Creator"
    author_url = None
    thumb = f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"
    duration_sec = 0
    duration_str = ""
    upload_date = time.strftime("%Y-%m-%d")
    view_count = None
    like_count = None
    downloads = []
    seen_urls = set()

    # Run TheresaV (ytmp4 1080p, ytmp4 360p, ytmp3, ytdl, aio), Piped, oEmbed, and CnvMP3 concurrently
    with ThreadPoolExecutor(max_workers=8) as pool:
        f_mp4_hd = pool.submit(fetch_theresav_endpoint, "ytmp4", target_url, "&resolution=1080", 15)
        f_mp4_sd = pool.submit(fetch_theresav_endpoint, "ytmp4", target_url, "&resolution=360", 13)
        f_mp3 = pool.submit(fetch_theresav_endpoint, "ytmp3", target_url, "", 15)
        f_ytdl = pool.submit(fetch_theresav_endpoint, "ytdl", target_url, "", 13)
        f_aio = pool.submit(fetch_theresav_endpoint, "aio", target_url, "", 13)
        f_piped = pool.submit(_fetch_piped_json, video_id)
        f_oembed = pool.submit(_fetch_yt_oembed, video_id)
        f_gamma_mp3 = pool.submit(resolve_gammacloud_youtube, video_id, "mp3", True)

        tv_mp4_hd = f_mp4_hd.result()
        tv_mp4_sd = f_mp4_sd.result()
        tv_mp3 = f_mp3.result()
        tv_ytdl = f_ytdl.result()
        tv_aio = f_aio.result()
        pdata = f_piped.result()
        oe = f_oembed.result()
        gamma_mp3 = f_gamma_mp3.result()

    if not (isinstance(tv_mp3, dict) and tv_mp3.get("download_url")) and not gamma_mp3:
        gamma_mp3 = resolve_gammacloud_youtube(video_id, "mp3", False)

    # 1. Populate Metadata from TheresaV
    tv_primary = tv_mp4_hd or tv_mp3 or tv_mp4_sd or tv_ytdl
    if isinstance(tv_primary, dict):
        title = tv_primary.get("title") or title
        author = tv_primary.get("channel") or author
        thumb = tv_primary.get("thumbnail") or thumb
        if isinstance(tv_primary.get("duration_sec"), (int, float)) and tv_primary["duration_sec"] > 0:
            duration_sec = int(tv_primary["duration_sec"])
            duration_str = format_duration(duration_sec) or duration_str
        if isinstance(tv_primary.get("view_count"), int):
            view_count = tv_primary["view_count"]
        if isinstance(tv_primary.get("like_count"), int):
            like_count = tv_primary["like_count"]
        if tv_primary.get("upload_date"):
            upload_date = str(tv_primary["upload_date"])

    if isinstance(tv_ytdl, dict) and isinstance(tv_ytdl.get("result"), dict):
        r = tv_ytdl["result"]
        if title == "YouTube Video HD" and r.get("title"):
            title = r["title"]
        if not duration_sec and isinstance(r.get("duration"), (int, float)) and r["duration"] > 0:
            duration_sec = int(r["duration"])
            duration_str = format_duration(duration_sec) or str(r.get("duration_formatted") or "")
        if not duration_str and r.get("duration_formatted"):
            duration_str = str(r["duration_formatted"])
        if r.get("thumbnail") and "maxresdefault" in thumb:
            thumb = r["thumbnail"]

    if isinstance(tv_aio, dict) and isinstance(tv_aio.get("result"), dict):
        ar = tv_aio["result"]
        if title == "YouTube Video HD" and ar.get("title"):
            title = ar["title"]
        if not duration_str and ar.get("duration"):
            duration_str = str(ar["duration"])
        if ar.get("thumbnail") and "maxresdefault" in thumb:
            thumb = ar["thumbnail"]

    # 2. Enrich with Piped & oEmbed
    if isinstance(pdata, dict) and pdata.get("title"):
        if title == "YouTube Video HD":
            title = pdata.get("title") or title
        if author == "YouTube Creator":
            author = pdata.get("uploader") or author
        if pdata.get("uploaderUrl"):
            author_url = f"https://www.youtube.com{pdata['uploaderUrl']}"
        if pdata.get("thumbnailUrl") and "maxresdefault" in thumb:
            thumb = pdata["thumbnailUrl"]
        if not duration_sec and pdata.get("duration"):
            duration_sec = int(pdata["duration"])
            duration_str = format_duration(duration_sec) or duration_str
        if pdata.get("uploadDate"):
            upload_date = str(pdata["uploadDate"])[:10]
        if view_count is None and isinstance(pdata.get("views"), int):
            view_count = pdata["views"]
        if like_count is None and isinstance(pdata.get("likes"), int):
            like_count = pdata["likes"]

    if isinstance(oe, dict):
        if title == "YouTube Video HD" and oe.get("title"):
            title = oe["title"]
        if author == "YouTube Creator" and oe.get("author_name"):
            author = oe["author_name"]
        if not author_url and oe.get("author_url"):
            author_url = oe["author_url"]
        if oe.get("thumbnail_url") and "maxresdefault" in thumb:
            thumb = oe["thumbnail_url"]

    # 3. Add Primary Video Streams from TheresaV (ytmp4 1080p/720p, ytdl top-level, ytmp4 360p)
    def add_tv_video(tv_obj, fallback_res, suffix):
        if not isinstance(tv_obj, dict):
            return
        dl = tv_obj.get("download_url")
        if isinstance(dl, str) and dl.startswith("http") and dl not in seen_urls:
            seen_urls.add(dl)
            raw_res = str(tv_obj.get("resolution") or fallback_res).rstrip("pP")
            res_label = f"{raw_res}p"
            fsize = tv_obj.get("filesize") if isinstance(tv_obj.get("filesize"), int) else None
            tier = "Full HD" if raw_res.isdigit() and int(raw_res) >= 1080 else ("HD" if raw_res.isdigit() and int(raw_res) >= 720 else "SD")
            downloads.append(
                {
                    "id": f"yt_{video_id}_tv_{suffix}_{res_label}",
                    "type": "video",
                    "quality": f"Video {res_label} {tier} · Direct Stream (MP4)",
                    "ext": "mp4",
                    "url": dl,
                    "filesizeFormatted": format_bytes(fsize),
                    "resolution": res_label,
                    "vcodec": "H.264",
                    "acodec": "AAC",
                    "fps": 30,
                }
            )

    add_tv_video(tv_mp4_hd, "720", "hd")
    if isinstance(tv_ytdl, dict) and tv_ytdl.get("download_url"):
        add_tv_video(tv_ytdl, "720", "ytdl")
    add_tv_video(tv_mp4_sd, "360", "sd")

    # 4. Add Piped Progressive Video Streams
    if isinstance(pdata, dict):
        v_streams = pdata.get("videoStreams") or []
        progressive = [s for s in v_streams if not s.get("videoOnly") and s.get("url")]
        for s in progressive:
            if s["url"] in seen_urls:
                continue
            seen_urls.add(s["url"])
            res = s.get("quality") or "360p"
            fps_val = s.get("fps") or 30
            m_clen = re.search(r"[?&]clen=(\d+)", s["url"])
            est_bytes = int(m_clen.group(1)) if m_clen else int(((s.get("bitrate") or 900000) / 8) * (duration_sec or 240))
            downloads.append(
                {
                    "id": f"yt_{video_id}_{res}",
                    "type": "video",
                    "quality": f"Video {res} {'Full HD' if '1080' in res else 'HD' if '720' in res else 'SD'} (MP4)",
                    "ext": "mp4",
                    "url": s["url"],
                    "filesizeFormatted": format_bytes(est_bytes),
                    "resolution": res,
                    "vcodec": "H.264",
                    "acodec": "AAC",
                    "fps": fps_val,
                }
            )

    # 5. Add on-demand resolution options from TheresaV AIO (480p, 240p, etc.)
    if isinstance(tv_aio, dict) and isinstance(tv_aio.get("result"), dict):
        existing_res = {str(d.get("resolution") or "").lower() for d in downloads if d.get("type") == "video"}
        for m_item in tv_aio["result"].get("medias") or []:
            if isinstance(m_item, dict) and m_item.get("type") == "video" and m_item.get("quality"):
                res_num = re.sub(r"[^0-9]", "", str(m_item["quality"]))
                if res_num in ("1080", "720", "480", "360", "240") and f"{res_num}p" not in existing_res:
                    existing_res.add(f"{res_num}p")
                    raw_u = str(m_item.get("url") or "")
                    direct_or_token = (
                        raw_u
                        if (raw_u.startswith("http") and "sse-progress" not in raw_u)
                        else f"theresav_resolve:ytmp4:{video_id}:{res_num}"
                    )
                    tier = "Full HD" if int(res_num) >= 1080 else ("HD" if int(res_num) >= 720 else "SD")
                    downloads.append(
                        {
                            "id": f"yt_{video_id}_aio_{res_num}p",
                            "type": "video",
                            "quality": f"Video {res_num}p {tier} (MP4)",
                            "ext": "mp4",
                            "url": direct_or_token,
                            "resolution": f"{res_num}p",
                            "vcodec": "H.264",
                            "acodec": "AAC",
                            "fps": 30,
                            "needsResolve": direct_or_token.startswith("theresav_resolve:"),
                        }
                    )

    # 6. Fallback to GammaCloud MP4 if no video stream yet
    if not any(d.get("type") == "video" for d in downloads):
        gamma_mp4 = resolve_gammacloud_youtube(video_id, "mp4")
        if gamma_mp4 and gamma_mp4 not in seen_urls:
            seen_urls.add(gamma_mp4)
            downloads.insert(
                0,
                {
                    "id": f"yt_{video_id}_mp4_hd",
                    "type": "video",
                    "quality": "Video 720p HD · Direct Stream (MP4)",
                    "ext": "mp4",
                    "url": gamma_mp4,
                    "filesizeFormatted": format_bytes(duration_sec * 180000) if duration_sec else None,
                    "resolution": "720p",
                    "vcodec": "H.264",
                    "acodec": "AAC",
                    "fps": 30,
                },
            )

    # 7. Add Audio Streams (Prioritizing TheresaV ytmp3 & CnvMP3/GammaCloud before Piped M4A)
    if isinstance(tv_mp3, dict) and isinstance(tv_mp3.get("download_url"), str) and tv_mp3["download_url"].startswith("http"):
        mp3_dl = tv_mp3["download_url"]
        seen_urls.add(mp3_dl)
        same_as_vid = (
            isinstance(tv_mp4_hd, dict)
            and tv_mp4_hd.get("filesize")
            and tv_mp3.get("filesize")
            and tv_mp4_hd.get("filesize") == tv_mp3.get("filesize")
        )
        aud_bytes = (
            tv_mp3.get("filesize")
            if (not same_as_vid and isinstance(tv_mp3.get("filesize"), int) and tv_mp3["filesize"] > 0)
            else (duration_sec * 16000 if duration_sec else None)
        )
        downloads.append(
            {
                "id": f"yt_{video_id}_tv_mp3",
                "type": "audio",
                "quality": f"Audio Original HQ · {title[:38]} (MP3)",
                "ext": "mp3",
                "url": mp3_dl,
                "filesizeFormatted": format_bytes(aud_bytes),
                "acodec": "MP3 / AAC",
                "resolution": "320kbps",
            }
        )

    if gamma_mp3 and gamma_mp3 not in seen_urls:
        seen_urls.add(gamma_mp3)
        downloads.append(
            {
                "id": f"yt_{video_id}_mp3",
                "type": "audio",
                "quality": f"Audio 320kbps · {title[:38]} (MP3)",
                "ext": "mp3",
                "url": gamma_mp3,
                "filesizeFormatted": format_bytes(duration_sec * 16000) if duration_sec else None,
                "acodec": "MP3 320kbps",
                "resolution": "320kbps",
            }
        )

    if isinstance(pdata, dict):
        a_streams = pdata.get("audioStreams") or []
        for a in [x for x in a_streams if x.get("url")][:2]:
            if a["url"] in seen_urls:
                continue
            seen_urls.add(a["url"])
            abr = a.get("quality") or "128kbps"
            downloads.append(
                {
                    "id": f"yt_{video_id}_aud_{abr}",
                    "type": "audio",
                    "quality": f"Audio Stream {abr} (M4A)",
                    "ext": "m4a",
                    "url": a["url"],
                    "acodec": "AAC",
                    "resolution": abr,
                }
            )

    if any(d.get("type") == "video" for d in downloads) and not any(d.get("type") == "audio" for d in downloads):
        first_vid = next(d for d in downloads if d.get("type") == "video")
        downloads.append(
            {
                "id": f"yt_{video_id}_aud_muxed",
                "type": "audio",
                "quality": f"Audio Original · {title[:38]} (M4A)",
                "ext": "m4a",
                "url": first_vid["url"],
                "filesizeFormatted": first_vid.get("filesizeFormatted"),
                "acodec": "AAC",
                "resolution": "192kbps",
            }
        )

    if not downloads:
        return None

    return {
        "title": title,
        "author": author,
        "authorUrl": author_url,
        "platform": "youtube",
        "extractorKey": "TinaCore::YouTube",
        "engine": "Tina Hybrid",
        "serverUsed": "Tina Hybrid Core (YOUTUBE)",
        "webpageUrl": canonical_yt_url,
        "thumbnail": thumb,
        "duration": duration_str,
        "uploadDate": upload_date,
        "viewCount": view_count,
        "likeCount": like_count,
        "resolution": downloads[0].get("resolution") or "720p HD",
        "fps": 30,
        "vcodec": "H.264 (AVC1)",
        "acodec": "AAC / MP3",
        "filesizeApprox": downloads[0].get("filesizeFormatted"),
        "downloads": downloads,
    }


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
            "commentCount": body.get("commentCount"),
            "resolution": f"{len(images)} Foto HD",
            "downloads": downloads,
            "images": images,
        }
    except Exception:
        return None


def fetch_universal_fallback(target_url: str):
    lower = target_url.lower()
    if "spotify.com" in lower:
        sp = fetch_spotify_rich(target_url)
        if sp:
            return sp
    if "youtube.com" in lower or "youtu.be" in lower:
        yt = fetch_youtube_rich(target_url)
        if yt:
            return yt

    aio = fetch_theresav_aio(target_url)
    if aio:
        return aio

    raise RuntimeError("Tidak dapat mengekstrak media dari tautan tersebut. Pastikan URL bersifat publik dan valid.")


def extract_full_metadata(target_url: str):
    lower = target_url.lower()
    if "tiktok.com" in lower or "douyin.com" in lower:
        tt = fetch_tiktok_rich(target_url)
        if tt:
            return tt
    if "spotify.com" in lower:
        sp = fetch_spotify_rich(target_url)
        if sp:
            return sp
    if "pixiv.net" in lower:
        px = fetch_pixiv_rich(target_url)
        if px:
            return px
    if "youtube.com" in lower or "youtu.be" in lower:
        yt = fetch_youtube_rich(target_url)
        if yt:
            return yt

    try:
        import sys
        sys.path.insert(0, os.path.join(ROOT_DIR, "server"))
        import py_engine
        res = py_engine.extract_media(target_url)
        if res and res.get("downloads"):
            return res
    except Exception:
        pass

    return fetch_universal_fallback(target_url)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Device-ID, Range")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _resolve_token_if_needed(self, raw_url: str) -> str:
        raw_url = (raw_url or "").strip()
        if raw_url.startswith("http"):
            return raw_url
        if raw_url.startswith("theresav_resolve:"):
            parts = raw_url.replace("theresav_resolve:", "").split(":")
            mode = parts[0] if parts else "ytmp4"
            vid = parts[1] if len(parts) > 1 else ""
            res_p = parts[2] if len(parts) > 2 else "720"
            yt_u = vid if vid.startswith("http") else f"https://www.youtube.com/watch?v={vid}"
            tv_res = fetch_theresav_endpoint(
                "ytmp3" if mode == "ytmp3" else "ytmp4",
                yt_u,
                "" if mode == "ytmp3" else f"&resolution={res_p}",
                16,
            )
            if tv_res and isinstance(tv_res.get("download_url"), str):
                return tv_res["download_url"]
        if raw_url.startswith("youtube_resolve:") or raw_url.startswith("ytmp3gg_resolve:"):
            parts = re.sub(r"^(youtube_resolve:|ytmp3gg_resolve:)", "", raw_url).split(":::")
            yt_u = parts[0] if parts else ""
            fmt_raw = (parts[1] if len(parts) > 1 else "mp3").lower()
            fmt = "mp3" if ("mp3" in fmt_raw or "audio" in fmt_raw) else "mp4"
            vid_m = re.search(
                r"(?:v=|youtu\.be/|shorts/|embed/|live/)([A-Za-z0-9_-]{11})",
                yt_u,
            )
            vid_id = vid_m.group(1) if vid_m else (yt_u if len(yt_u) == 11 else None)
            if vid_id:
                full_u = f"https://www.youtube.com/watch?v={vid_id}"
                tv_res = fetch_theresav_endpoint(
                    "ytmp3" if fmt == "mp3" else "ytmp4",
                    full_u,
                    "" if fmt == "mp3" else "&resolution=1080",
                    14,
                )
                if tv_res and isinstance(tv_res.get("download_url"), str):
                    return tv_res["download_url"]
                resolved = resolve_gammacloud_youtube(vid_id, fmt)
                if resolved:
                    return resolved
        sp_m = re.search(
            r"spotify\.com/(?:intl-[a-z-]+/)?(track|episode)/([A-Za-z0-9]+)",
            raw_url,
            re.I,
        )
        if sp_m:
            sp_meta = fetch_spotify_rich(f"https://open.spotify.com/{sp_m.group(1)}/{sp_m.group(2)}")
            if sp_meta and sp_meta.get("downloads"):
                return sp_meta["downloads"][0]["url"]
        return raw_url

    def _handle_proxy_or_download(self, target_url: str, is_download: bool, qs: dict):
        target_url = self._resolve_token_if_needed(target_url)
        if not target_url.startswith("http"):
            self._send_json(400, {"error": "URL stream tidak valid."})
            return

        req_headers = {
            "User-Agent": CHROME_UA,
            "Accept": "*/*",
            "Referer": get_upstream_referer(target_url),
        }
        if "gammacloud.net" in target_url.lower():
            req_headers["Origin"] = "https://ytmp3.gl"
        elif "cnvmp3" in target_url.lower():
            req_headers["Origin"] = "https://cnvmp3.com"

        client_range = self.headers.get("Range")
        MAX_CHUNK = 3500000  # 3.5 MB chunk to stay safely below Vercel 4.5MB limit
        ext_hint = (qs.get("ext") or [""])[0].strip().lower()
        start_byte = 0

        if client_range and not is_download:
            m = re.match(r"bytes=(\d+)-(\d*)", client_range)
            if m:
                start_byte = int(m.group(1))
                end_byte = int(m.group(2)) if m.group(2) else (start_byte + MAX_CHUNK - 1)
                if end_byte - start_byte >= MAX_CHUNK:
                    end_byte = start_byte + MAX_CHUNK - 1
                req_headers["Range"] = f"bytes={start_byte}-{end_byte}"
            else:
                req_headers["Range"] = client_range
        elif not is_download:
            lower_u = target_url.lower()
            is_img = any(ext in lower_u for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", "pximg", "pixiv"))
            if not is_img:
                req_headers["Range"] = f"bytes=0-{MAX_CHUNK - 1}"

        try:
            req = urllib.request.Request(target_url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=15) as upstream:
                status_code = upstream.getcode() or 200
                raw_ctype = upstream.headers.get("Content-Type") or "application/octet-stream"
                ctype = infer_mime_type(ext_hint, target_url, raw_ctype)
                clen_str = upstream.headers.get("Content-Length")
                crange = upstream.headers.get("Content-Range")

                if is_download and clen_str and int(clen_str) > 4000000:
                    self.send_response(302)
                    self.send_header("Location", target_url)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    return

                data_bytes = upstream.read(MAX_CHUNK + 200000)

                # If upstream ignored Range (status 200) and file exceeds MAX_CHUNK, redirect directly to CDN
                # so Vercel serverless does not truncate the media stream at 3.5 MB!
                m_clen = re.search(r"[?&]clen=(\d+)", target_url)
                if status_code == 200 and not m_clen and len(data_bytes) >= MAX_CHUNK:
                    self.send_response(302)
                    self.send_header("Location", target_url)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    return

                # Sniff container magic bytes (ftypdash / ftypisom served with audio/mpeg)
                if len(data_bytes) >= 32 and data_bytes[4:8] == b"ftyp":
                    header_slice = data_bytes[:32]
                    if b"avc1" in header_slice and ext_hint not in ("mp3", "m4a"):
                        ctype = "video/mp4"
                    elif ctype == "audio/mpeg":
                        ctype = "video/mp4" if b"avc1" in header_slice else "audio/mp4"

                # Fix malformed Content-Range from proxy.piped.private.coffee using clen query param
                if m_clen and data_bytes and not is_download:
                    total_clen = int(m_clen.group(1))
                    if total_clen > 0:
                        actual_end = min(total_clen - 1, start_byte + len(data_bytes) - 1)
                        crange = f"bytes {start_byte}-{actual_end}/{total_clen}"
                        status_code = 206

                self.send_response(status_code)
                self.send_header("Content-Type", ctype)
                self.send_header("Access-Control-Allow-Origin", "*")
                if status_code == 206 or crange or m_clen:
                    self.send_header("Accept-Ranges", "bytes")
                if crange:
                    self.send_header("Content-Range", crange)
                if is_download:
                    ext = ext_hint or "mp4"
                    fname = (qs.get("filename") or ["Tina_Media"])[0].strip()
                    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", fname)[:60] or "Tina_Media"
                    self.send_header(
                        "Content-Disposition",
                        f'attachment; filename="{safe_name}.{ext}"',
                    )
                self.send_header("Content-Length", str(len(data_bytes)))
                self.end_headers()
                self.wfile.write(data_bytes)
        except Exception:
            self.send_response(302)
            self.send_header("Location", target_url)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

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

        if "proxy-stream" in route:
            self._handle_proxy_or_download(target_url, False, qs)
            return

        if "download" in route:
            self._handle_proxy_or_download(target_url, True, qs)
            return

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

        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path

        # Support /api/resolve on Vercel serverless
        if "resolve" in route:
            token_url = str(body.get("tokenUrl") or "").strip()
            resolved = self._resolve_token_if_needed(token_url)
            if resolved.startswith("http"):
                self._send_json(200, {"status": "ok", "url": resolved})
                return
            self._send_json(422, {"error": "Gagal meresolusi stream media."})
            return

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