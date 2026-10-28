#!/usr/bin/env python3
"""
Tina Downloader — Python 3 Backend Engine + SQLite3 Database
"""

import json
import math
import os
import re
import sqlite3
import subprocess
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
EXTRACTOR_BIN = os.path.join(BASE_DIR, "engines", "yt-dlp")
DATA_DIR = os.path.join(BASE_DIR, "data")
SQLITE_DB_PATH = os.path.join(DATA_DIR, "tina.sqlite")


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            platform TEXT NOT NULL,
            engine TEXT NOT NULL,
            thumbnail TEXT,
            duration TEXT,
            quality TEXT,
            created_at INTEGER NOT NULL,
            metadata_json TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS security_logs (
            id TEXT PRIMARY KEY,
            ip_address TEXT NOT NULL,
            device_id TEXT NOT NULL,
            user_agent TEXT,
            action TEXT NOT NULL,
            platform TEXT,
            engine TEXT,
            url TEXT,
            status TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def format_bytes(size):
    if not size or size <= 0:
        return ""
    units = ["B", "KB", "MB", "GB"]
    idx = min(int(math.log(size, 1024)), len(units) - 1)
    return f"{size / (1024 ** idx):.1f} {units[idx]}"


def format_duration(seconds):
    if not seconds or seconds <= 0:
        return ""
    s = int(seconds)
    hrs = s // 3600
    mins = (s % 3600) // 60
    secs = s % 60
    if hrs > 0:
        return f"{hrs}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"


def format_upload_date(raw):
    if not raw:
        return ""
    raw_str = str(raw)
    if re.match(r"^\d{8}$", raw_str):
        return f"{raw_str[:4]}-{raw_str[4:6]}-{raw_str[6:8]}"
    return raw_str


def extract_media(target_url: str):
    if not os.path.exists(EXTRACTOR_BIN):
        raise RuntimeError("Komponen ekstraktor Tina Downloader tidak ditemukan.")

    try:
        os.chmod(EXTRACTOR_BIN, 0o755)
    except Exception:
        pass

    args = [
        EXTRACTOR_BIN,
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        "--no-check-certificates",
        "--geo-bypass",
        target_url,
    ]
    proc = subprocess.run(args, capture_output=True, text=True, timeout=28)
    if proc.returncode != 0 and not proc.stdout.strip():
        lines = [l.strip() for l in (proc.stderr or "").splitlines() if l.strip()]
        raise RuntimeError(lines[-1] if lines else "Gagal mengekstrak media dari tautan tersebut.")

    json_lines = [line.strip() for line in proc.stdout.splitlines() if line.strip().startswith("{")]
    if not json_lines:
        raise RuntimeError("Metadata kosong dari sumber media.")

    info = json.loads(json_lines[0])
    raw_formats = info.get("formats") or []
    downloads = []
    images = []
    seen = set()

    # Check if entries or thumbnails/images exist for multi-image posts
    if isinstance(info.get("entries"), list):
        for idx, entry in enumerate(info["entries"]):
            if not isinstance(entry, dict):
                continue
            e_url = entry.get("url")
            e_ext = (entry.get("ext") or "").lower()
            if e_url and e_ext in ("jpg", "jpeg", "png", "webp", "gif"):
                images.append(e_url)
                downloads.append(
                    {
                        "id": f"img_{idx + 1}",
                        "type": "image",
                        "quality": f"Foto Slide #{idx + 1} ({e_ext.upper()})",
                        "ext": e_ext or "jpg",
                        "url": e_url,
                        "resolution": f"{entry.get('width')}x{entry.get('height')}"
                        if entry.get("width") and entry.get("height")
                        else "Resolusi Penuh",
                    }
                )

    for f in reversed(raw_formats):
        f_url = f.get("url")
        protocol = str(f.get("protocol") or "")
        if not f_url or protocol == "mhtml":
            continue
        is_manifest = "m3u8" in protocol or "dash" in protocol
        vcodec = f.get("vcodec")
        acodec = f.get("acodec")
        ext = (f.get("ext") or "").lower()

        if ext in ("jpg", "jpeg", "png", "webp") and f_url not in images:
            images.append(f_url)
            downloads.append(
                {
                    "id": str(f.get("format_id") or f"img_{len(images)}"),
                    "type": "image",
                    "quality": f"Foto Resolusi Penuh #{len(images)} ({ext.upper()})",
                    "ext": ext,
                    "url": f_url,
                    "resolution": f"{f.get('width')}x{f.get('height')}"
                    if f.get("width") and f.get("height")
                    else "HD",
                }
            )
            continue

        has_video = bool(vcodec and vcodec != "none")
        has_audio = bool(acodec and acodec != "none")
        size_bytes = f.get("filesize") or f.get("filesize_approx")
        out_ext = ext or ("mp4" if has_video else "m4a")

        if has_video and not is_manifest:
            height_num = f.get("height")
            if height_num:
                if height_num >= 2160:
                    res_tag = f"{height_num}p 4K UHD"
                elif height_num >= 1440:
                    res_tag = f"{height_num}p 2K QHD"
                elif height_num >= 1080:
                    res_tag = f"{height_num}p Full HD"
                elif height_num >= 720:
                    res_tag = f"{height_num}p HD"
                else:
                    res_tag = f"{height_num}p SD"
            else:
                res_tag = f.get("format_note") or "Original HD"

            fps = f.get("fps")
            fps_tag = f" {int(fps)}fps" if fps and fps > 30 else ""
            audio_badge = "" if has_audio else " · Tanpa Audio"
            key = f"v_{height_num or res_tag}_{out_ext}_{has_audio}"
            if key not in seen:
                seen.add(key)
                downloads.append(
                    {
                        "id": str(f.get("format_id") or f"v_{len(downloads)}"),
                        "type": "video",
                        "quality": f"Video {res_tag}{fps_tag} ({out_ext.upper()}){audio_badge}",
                        "ext": out_ext,
                        "url": f_url,
                        "filesize": size_bytes,
                        "filesizeFormatted": format_bytes(size_bytes),
                        "vcodec": vcodec if vcodec != "none" else None,
                        "acodec": acodec if acodec != "none" else None,
                        "fps": int(fps) if fps else None,
                        "tbr": int(f["tbr"]) if f.get("tbr") else None,
                        "resolution": f"{height_num}p"
                        if height_num
                        else (
                            f.get("resolution")
                            or (f"{f.get('width')}x{f.get('height')}" if f.get("width") and f.get("height") else None)
                        ),
                    }
                )
        elif has_audio and not is_manifest:
            abr = int(f["abr"]) if f.get("abr") else (int(f["tbr"]) if f.get("tbr") else None)
            abr_label = f"{abr}kbps" if abr else "Original"
            key = f"a_{abr_label}_{out_ext}"
            if key not in seen:
                seen.add(key)
                downloads.append(
                    {
                        "id": str(f.get("format_id") or f"a_{len(downloads)}"),
                        "type": "audio",
                        "quality": f"Audio {abr_label} ({out_ext.upper()})",
                        "ext": out_ext,
                        "url": f_url,
                        "filesize": size_bytes,
                        "filesizeFormatted": format_bytes(size_bytes),
                        "acodec": acodec if acodec != "none" else None,
                        "tbr": abr,
                        "resolution": f"{abr_label}",
                    }
                )

    if not downloads and info.get("url"):
        size_bytes = info.get("filesize") or info.get("filesize_approx")
        ext = (info.get("ext") or "mp4").lower()
        is_img = ext in ("jpg", "jpeg", "png", "webp", "gif")
        is_aud = info.get("vcodec") == "none" or ext in ("mp3", "m4a", "ogg", "wav", "flac", "opus")
        if is_img:
            images.append(info.get("url"))
            downloads.append(
                {
                    "id": "img_main",
                    "type": "image",
                    "quality": f"Foto Resolusi Penuh ({ext.upper()})",
                    "ext": ext,
                    "url": info.get("url"),
                    "filesize": size_bytes,
                    "filesizeFormatted": format_bytes(size_bytes),
                    "resolution": info.get("resolution") or "Original",
                }
            )
        else:
            downloads.append(
                {
                    "id": str(info.get("format_id") or "best"),
                    "type": "audio" if is_aud else "video",
                    "quality": f"{'Audio' if is_aud else 'Video'} {info.get('resolution') or 'Original HD'} ({ext.upper()})",
                    "ext": ext,
                    "url": info.get("url"),
                    "filesize": size_bytes,
                    "filesizeFormatted": format_bytes(size_bytes),
                    "vcodec": info.get("vcodec"),
                    "acodec": info.get("acodec"),
                    "fps": info.get("fps"),
                    "resolution": info.get("resolution"),
                }
            )

    # Sort downloads so Video with Audio comes first (highest resolution first), then Audio, then Video-only
    def sort_key(item):
        t = item.get("type")
        has_aud = bool(item.get("acodec"))
        res_str = str(item.get("resolution") or item.get("quality") or "")
        m = re.search(r"(\d{3,4})p", res_str)
        height_val = int(m.group(1)) if m else 0
        if t == "video" and has_aud:
            return (0, -height_val)
        if t == "video":
            return (1, -height_val)
        if t == "audio":
            return (2, -(item.get("tbr") or 0))
        return (3, 0)

    downloads.sort(key=sort_key)

    extractor_key = info.get("extractor_key") or info.get("extractor") or "Universal"
    platform = str(extractor_key).lower()
    thumb = info.get("thumbnail") or ""
    if not thumb and isinstance(info.get("thumbnails"), list) and info["thumbnails"]:
        thumb = info["thumbnails"][-1].get("url") or ""

    return {
        "title": info.get("title") or info.get("fulltitle") or "Untitled Media",
        "author": info.get("uploader") or info.get("channel") or info.get("creator") or info.get("artist") or "Creator",
        "authorUrl": info.get("uploader_url") or info.get("channel_url"),
        "platform": platform,
        "extractorKey": f"TinaCore::{extractor_key}",
        "engine": "Tina Hybrid",
        "serverUsed": f"Tina Hybrid Core ({extractor_key})",
        "webpageUrl": info.get("webpage_url") or target_url,
        "thumbnail": thumb or (images[0] if images else ""),
        "duration": info.get("duration_string") or format_duration(info.get("duration")),
        "durationSeconds": info.get("duration"),
        "uploadDate": format_upload_date(info.get("upload_date")),
        "viewCount": info.get("view_count"),
        "likeCount": info.get("like_count"),
        "commentCount": info.get("comment_count"),
        "description": str(info.get("description") or "")[:1000] if info.get("description") else None,
        "resolution": info.get("resolution")
        or (f"{info.get('width')}x{info.get('height')}" if info.get("width") and info.get("height") else None),
        "fps": info.get("fps"),
        "vcodec": info.get("vcodec") if info.get("vcodec") != "none" else None,
        "acodec": info.get("acodec") if info.get("acodec") != "none" else None,
        "filesizeApprox": format_bytes(info.get("filesize") or info.get("filesize_approx")),
        "tags": (info.get("tags") or [])[:12] if isinstance(info.get("tags"), list) else None,
        "categories": (info.get("categories") or [])[:6] if isinstance(info.get("categories"), list) else None,
        "downloads": downloads[:24],
        "images": images if images else None,
    }


def save_download_record(payload: dict):
    conn = init_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO downloads (
            id, device_id, ip_address, url, title, author,
            platform, engine, thumbnail, duration, quality,
            created_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["id"],
            payload["deviceId"],
            payload["ipAddress"],
            payload["url"],
            payload["title"],
            payload["author"],
            payload["platform"],
            payload.get("engine", "Tina Hybrid"),
            payload.get("thumbnail", ""),
            payload.get("duration", "-"),
            payload.get("quality", "HD"),
            int(payload.get("createdAt") or int(time.time() * 1000)),
            json.dumps(payload.get("metadata") or {}),
        ),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


def log_security_event(payload: dict):
    conn = init_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO security_logs (
            id, ip_address, device_id, user_agent, action,
            platform, engine, url, status, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["id"],
            payload["ipAddress"],
            payload["deviceId"],
            payload.get("userAgent", ""),
            payload.get("action", "extract"),
            payload.get("platform", "universal"),
            payload.get("engine", "Tina Hybrid"),
            payload.get("url", ""),
            payload.get("status", "allowed"),
            int(payload.get("timestamp") or int(time.time() * 1000)),
        ),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


def list_history(device_id: str, ip_address: str):
    conn = init_db()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM downloads
        WHERE device_id = ? OR ip_address = ?
        ORDER BY created_at DESC
        LIMIT 100
        """,
        (device_id, ip_address),
    )
    rows = cur.fetchall()
    conn.close()
    items = []
    for r in rows:
        meta = None
        if r["metadata_json"]:
            try:
                meta = json.loads(r["metadata_json"])
            except Exception:
                meta = None
        items.append(
            {
                "id": r["id"],
                "deviceId": r["device_id"],
                "ipAddress": r["ip_address"],
                "url": r["url"],
                "title": r["title"],
                "author": r["author"],
                "platform": r["platform"],
                "engine": r["engine"],
                "thumbnail": r["thumbnail"] or "",
                "duration": r["duration"] or "-",
                "quality": r["quality"] or "HD",
                "createdAt": r["created_at"],
                "metadata": meta,
            }
        )
    return {"items": items}


def delete_history(device_id: str, ip_address: str, target_id: str = ""):
    conn = init_db()
    cur = conn.cursor()
    if target_id:
        cur.execute(
            "DELETE FROM downloads WHERE id = ? AND (device_id = ? OR ip_address = ?)",
            (target_id, device_id, ip_address),
        )
    else:
        cur.execute(
            "DELETE FROM downloads WHERE device_id = ? OR ip_address = ?",
            (device_id, ip_address),
        )
    conn.commit()
    conn.close()
    return {"status": "ok"}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command specified"}))
        sys.exit(1)

    cmd = sys.argv[1]
    try:
        if cmd == "extract":
            url = sys.argv[2]
            res = extract_media(url)
            print(json.dumps({"status": "ok", "data": res}))
        elif cmd == "save_download":
            payload = json.loads(sys.stdin.read())
            print(json.dumps(save_download_record(payload)))
        elif cmd == "log_security":
            payload = json.loads(sys.stdin.read())
            print(json.dumps(log_security_event(payload)))
        elif cmd == "list_history":
            dev_id = sys.argv[2] if len(sys.argv) > 2 else ""
            ip_addr = sys.argv[3] if len(sys.argv) > 3 else ""
            print(json.dumps(list_history(dev_id, ip_addr)))
        elif cmd == "delete_history":
            dev_id = sys.argv[2] if len(sys.argv) > 2 else ""
            ip_addr = sys.argv[3] if len(sys.argv) > 3 else ""
            target_id = sys.argv[4] if len(sys.argv) > 4 else ""
            print(json.dumps(delete_history(dev_id, ip_addr, target_id)))
        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()