from http.server import BaseHTTPRequestHandler
import json
import subprocess
import urllib.parse
import os

YTDLP_BIN = os.path.join(os.path.dirname(__file__), "..", "server", "engines", "yt-dlp")


def format_bytes(b):
    if not b or b <= 0:
        return ""
    units = ["B", "KB", "MB", "GB"]
    i = 0
    val = float(b)
    while val >= 1024 and i < len(units) - 1:
        val /= 1024.0
        i += 1
    return f"{val:.1f} {units[i]}"


def extract_ytdlp_metadata(target_url: str):
    cmd = ["yt-dlp"]
    if os.path.exists(YTDLP_BIN):
        cmd = [YTDLP_BIN]

    args = cmd + [
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        "--no-check-certificates",
        "--geo-bypass",
        target_url,
    ]
    proc = subprocess.run(args, capture_output=True, text=True, timeout=28)
    if proc.returncode != 0 and not proc.stdout.strip():
        err_lines = [l.strip() for l in (proc.stderr or "").splitlines() if l.strip()]
        raise RuntimeError(err_lines[-1] if err_lines else "yt-dlp extraction failed")

    first_json = None
    for line in proc.stdout.splitlines():
        if line.strip().startswith("{"):
            first_json = line.strip()
            break
    if not first_json:
        raise RuntimeError("Empty yt-dlp JSON output")

    info = json.loads(first_json)
    return info


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        target_url = (qs.get("url") or [""])[0].strip()

        if not target_url.startswith("http"):
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid URL"}).encode("utf-8"))
            return

        try:
            info = extract_ytdlp_metadata(target_url)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "status": "ok",
                        "runtime": "python3",
                        "title": info.get("title"),
                        "uploader": info.get("uploader"),
                        "extractor": info.get("extractor_key") or info.get("extractor"),
                        "duration": info.get("duration_string"),
                        "resolution": info.get("resolution"),
                        "thumbnail": info.get("thumbnail"),
                    }
                ).encode("utf-8")
            )
        except Exception as exc:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(exc)}).encode("utf-8"))