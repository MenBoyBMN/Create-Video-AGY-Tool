#!/usr/bin/env python3
"""
AGY Video Studio — Visual QA Keyframe Validator & Thumbnail Extractor
Inspects rendered PNG stills in projects/<slug>/qa/ for blank frames, dimensions,
luminance/contrast health, and generates a crisp Project Hub thumbnail.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from PIL import Image, ImageStat


def inspect_image(img_path: Path, expected_w: int, expected_h: int) -> Dict[str, Any]:
    with Image.open(img_path) as im:
        rgb = im.convert("RGB")
        w, h = rgb.size
        gray = rgb.convert("L")
        stat = ImageStat.Stat(gray)
        mean_luma = float(stat.mean[0])
        std_luma = float(stat.stddev[0])

        warnings: List[str] = []
        if w != expected_w or h != expected_h:
            warnings.append(f"Unexpected dimensions {w}x{h} (expected {expected_w}x{expected_h})")
        if std_luma < 4.0:
            warnings.append("Frame appears blank or single-color (very low variance)")
        if mean_luma < 5.0:
            warnings.append("Frame is almost completely dark")
        if mean_luma > 250.0:
            warnings.append("Frame is almost completely white/overexposed")

        return {
            "file": img_path.name,
            "path": str(img_path),
            "width": w,
            "height": h,
            "meanLuma": round(mean_luma, 2),
            "contrastStd": round(std_luma, 2),
            "ok": len(warnings) == 0,
            "warnings": warnings,
        }


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="AGY Video Studio Visual QA Validator")
    parser.add_argument("--app-root", required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--expected-width", type=int, default=1920)
    parser.add_argument("--expected-height", type=int, default=1080)
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
    qa_dir = project_dir / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)

    stills = sorted(
        p for p in qa_dir.glob("*.png") if p.name.lower() != "thumbnail.png"
    )

    inspections = [
        inspect_image(p, args.expected_width, args.expected_height) for p in stills
    ]

    # Pick hero thumbnail (prefer first beat's settle frame with good contrast)
    thumb_path = qa_dir / "thumbnail.png"
    best = None
    if inspections:
        healthy = [item for item in inspections if item["ok"]]
        pool = healthy if healthy else inspections
        # Prefer first beat settle frame if present, else highest contrast
        settle_first = [item for item in pool if "_settle" in item["file"]]
        best = settle_first[0] if settle_first else max(pool, key=lambda x: x["contrastStd"])
        with Image.open(best["path"]) as im:
            rgb = im.convert("RGB")
            rgb.thumbnail((640, 640), Image.Resampling.LANCZOS)
            rgb.save(thumb_path, format="PNG", optimize=True)

        # Update project.json thumbnail
        project_json_path = project_dir / "project.json"
        if project_json_path.exists():
            meta = json.loads(project_json_path.read_text(encoding="utf-8-sig"))
            meta["thumbnail"] = "qa/thumbnail.png"
            meta["updatedAt"] = datetime.now(timezone.utc).astimezone().isoformat()
            project_json_path.write_text(
                json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
            )

    all_ok = len(inspections) > 0 and all(item["ok"] for item in inspections)
    report = {
        "ok": all_ok,
        "project": args.project,
        "frameCount": len(inspections),
        "thumbnail": str(thumb_path) if best else None,
        "frames": inspections,
    }
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
