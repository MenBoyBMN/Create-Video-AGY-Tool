#!/usr/bin/env python3
"""
AGY Video Studio — Free Stock B-Roll & Editorial Image Fetcher
Supports:
  - Pexels API (free PEXELS_API_KEY in .env) — HD/4K videos & photos
  - Pixabay API (free PIXABAY_API_KEY in .env) — HD videos & photos
  - Wikimedia Commons API (100% keyless!) — historical, editorial, scientific photos
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional


def load_env(env_path: Path) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not env_path.exists():
        return out
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]+", "_", text.strip().lower()).strip("_")
    return s[:48] or "media"


def http_json(url: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "AGY-Video-Studio/2.0", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "AGY-Video-Studio/2.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        dest.write_bytes(resp.read())


def search_pexels(
    query: str, media_type: str, orientation: str, api_key: str
) -> Optional[Dict[str, str]]:
    q = urllib.parse.quote(query)
    if media_type == "video":
        url = f"https://api.pexels.com/videos/search?query={q}&orientation={orientation}&per_page=5"
        data = http_json(url, {"Authorization": api_key})
        videos = data.get("videos") or []
        if not videos:
            return None
        v = videos[0]
        files = sorted(
            [f for f in (v.get("video_files") or []) if f.get("file_type") == "video/mp4"],
            key=lambda x: abs(int(x.get("height") or 0) - 1080),
        )
        if not files:
            return None
        return {
            "url": files[0]["link"],
            "ext": ".mp4",
            "source": "pexels",
            "credit": f"Pexels / {(v.get('user') or {}).get('name', 'Creator')}",
            "pageUrl": v.get("url", ""),
        }

    url = f"https://api.pexels.com/v1/search?query={q}&orientation={orientation}&per_page=5"
    data = http_json(url, {"Authorization": api_key})
    photos = data.get("photos") or []
    if not photos:
        return None
    p = photos[0]
    src = p.get("src") or {}
    dl = src.get("large2x") or src.get("original") or src.get("large")
    if not dl:
        return None
    return {
        "url": dl,
        "ext": ".jpg",
        "source": "pexels",
        "credit": f"Pexels / {p.get('photographer', 'Creator')}",
        "pageUrl": p.get("url", ""),
    }


def search_pixabay(
    query: str, media_type: str, orientation: str, api_key: str
) -> Optional[Dict[str, str]]:
    q = urllib.parse.quote(query)
    if media_type == "video":
        url = f"https://pixabay.com/api/videos/?key={urllib.parse.quote(api_key)}&q={q}&per_page=5"
        data = http_json(url)
        hits = data.get("hits") or []
        if not hits:
            return None
        h = hits[0]
        vids = h.get("videos") or {}
        chosen = vids.get("large") or vids.get("medium") or vids.get("small")
        if not chosen or not chosen.get("url"):
            return None
        return {
            "url": chosen["url"],
            "ext": ".mp4",
            "source": "pixabay",
            "credit": f"Pixabay / {h.get('user', 'Creator')}",
            "pageUrl": h.get("pageURL", ""),
        }

    ori = "vertical" if orientation == "portrait" else "horizontal"
    url = f"https://pixabay.com/api/?key={urllib.parse.quote(api_key)}&q={q}&orientation={ori}&image_type=photo&per_page=5"
    data = http_json(url)
    hits = data.get("hits") or []
    if not hits:
        return None
    h = hits[0]
    dl = h.get("largeImageURL") or h.get("webformatURL")
    if not dl:
        return None
    return {
        "url": dl,
        "ext": ".jpg",
        "source": "pixabay",
        "credit": f"Pixabay / {h.get('user', 'Creator')}",
        "pageUrl": h.get("pageURL", ""),
    }


def search_wikimedia(query: str) -> Optional[Dict[str, str]]:
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrnamespace": "6",
            "gsrsearch": f"{query} filetype:bitmap",
            "gsrlimit": "6",
            "prop": "imageinfo",
            "iiprop": "url|mime|extmetadata",
            "iiurlwidth": "1600",
        }
    )
    url = f"https://commons.wikimedia.org/w/api.php?{params}"
    data = http_json(url)
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        mime = info.get("mime", "")
        if mime not in ("image/jpeg", "image/png", "image/webp"):
            continue
        dl = info.get("thumburl") or info.get("url")
        if not dl:
            continue
        ext = ".png" if mime == "image/png" else (".webp" if mime == "image/webp" else ".jpg")
        return {
            "url": dl,
            "ext": ext,
            "source": "wikimedia",
            "credit": f"Wikimedia Commons / {page.get('title', '')}",
            "pageUrl": info.get("descriptionurl", ""),
        }
    return None


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="AGY Video Studio Free Stock Media Fetcher")
    parser.add_argument("--app-root", required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--type", choices=["video", "image"], default="image")
    parser.add_argument("--source", choices=["auto", "pexels", "pixabay", "wikimedia"], default="auto")
    parser.add_argument("--orientation", choices=["landscape", "portrait"], default="landscape")
    parser.add_argument("--out", default=None, help="Optional relative filename inside assets/")
    args = parser.parse_args()

    app_root = Path(args.app_root).resolve()
    projects_root = (app_root / "projects").resolve()
    project_dir = (projects_root / args.project).resolve()
    try:
        project_dir.relative_to(projects_root)
    except ValueError as exc:
        raise ValueError(f"Invalid project path: {args.project}") from exc
    if project_dir == projects_root:
        raise ValueError(f"Invalid project path: {args.project}")
    assets_dir = project_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    env = load_env(app_root / ".env")
    pexels_key = env.get("PEXELS_API_KEY") or os.environ.get("PEXELS_API_KEY", "")
    pixabay_key = env.get("PIXABAY_API_KEY") or os.environ.get("PIXABAY_API_KEY", "")

    order: List[str]
    if args.source == "auto":
        order = ["pexels", "pixabay", "wikimedia"] if args.type == "image" else ["pexels", "pixabay"]
    else:
        order = [args.source]

    found: Optional[Dict[str, str]] = None
    errors: List[str] = []
    for src in order:
        try:
            if src == "pexels":
                if not pexels_key:
                    errors.append("pexels: missing PEXELS_API_KEY in .env")
                    continue
                found = search_pexels(args.query, args.type, args.orientation, pexels_key)
            elif src == "pixabay":
                if not pixabay_key:
                    errors.append("pixabay: missing PIXABAY_API_KEY in .env")
                    continue
                found = search_pixabay(args.query, args.type, args.orientation, pixabay_key)
            elif src == "wikimedia":
                if args.type == "video":
                    errors.append("wikimedia: video type not supported")
                    continue
                found = search_wikimedia(args.query)
            if found:
                break
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{src}: {exc}")

    if not found:
        print(
            json.dumps(
                {
                    "ok": False,
                    "query": args.query,
                    "type": args.type,
                    "error": "No matching stock asset found.",
                    "details": errors,
                },
                ensure_ascii=False,
            )
        )
        return 1

    if args.out:
        rel_name = Path(args.out).name
        if not Path(rel_name).suffix:
            rel_name = f"{rel_name}{found['ext']}"
    else:
        rel_name = f"{slugify(args.query)}_{found['source']}{found['ext']}"

    dest = assets_dir / rel_name
    download_file(found["url"], dest)

    sources_path = assets_dir / "_sources.json"
    registry: Dict[str, Any] = {}
    if sources_path.exists():
        try:
            registry = json.loads(sources_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            registry = {}
    registry[f"assets/{rel_name}"] = {
        "query": args.query,
        "type": args.type,
        "source": found["source"],
        "credit": found["credit"],
        "pageUrl": found["pageUrl"],
    }
    sources_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        json.dumps(
            {
                "ok": True,
                "project": args.project,
                "relPath": f"assets/{rel_name}",
                "filePath": str(dest),
                "source": found["source"],
                "credit": found["credit"],
                "sizeBytes": dest.stat().st_size,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
