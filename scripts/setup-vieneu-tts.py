#!/usr/bin/env python3
"""
AGY Video Studio — Optional 1-Command Installer for VieNeu-TTS (Offline Vietnamese 3-Region + Voice Clone)
Creates `engine/audio/voices/` and installs the official `vieneu` SDK with prebuilt Windows wheels.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def check_espeak_ng() -> bool:
    if shutil.which("espeak-ng"):
        return True
    for candidate in (
        Path(r"C:\Program Files\eSpeak NG\espeak-ng.exe"),
        Path(r"C:\Program Files (x86)\eSpeak NG\espeak-ng.exe"),
    ):
        if candidate.exists():
            return True
    return False


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Setup optional VieNeu-TTS offline Vietnamese engine")
    parser.add_argument("--install", action="store_true", help="Install official `vieneu` SDK via pip")
    args = parser.parse_args()

    app_root = Path(__file__).resolve().parent.parent
    voices_dir = app_root / "engine" / "audio" / "voices"
    voices_dir.mkdir(parents=True, exist_ok=True)

    readme = voices_dir / "README.txt"
    readme.write_text(
        "Dat file giong mau (.wav 5-10 giay, sach nhieu) va file text tuong ung (.txt) vao thu muc nay.\n"
        "Vi du:\n"
        "  engine/audio/voices/narrator.wav\n"
        "  engine/audio/voices/narrator.txt  (noi dung cau noi trong file wav)\n"
        "Sau do chon giong doc trong storyboard.json la: \"vieneu:clone:narrator\"\n",
        encoding="utf-8",
    )

    has_espeak = check_espeak_ng()
    if not has_espeak:
        print("[AGY] Warning: eSpeak NG not found. VieNeu-TTS requires eSpeak NG on Windows:")
        print("      winget install eSpeak-NG.eSpeak-NG")
        print("      (or download .msi from https://github.com/espeak-ng/espeak-ng/releases)")

    if args.install:
        print("[AGY] Installing official `vieneu` SDK (prebuilt Windows wheel)...")
        cmd = [
            sys.executable,
            "-m",
            "pip",
            "install",
            "vieneu",
            "--extra-index-url",
            "https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/",
        ]
        res = subprocess.run(cmd, check=False)
        if res.returncode != 0:
            print("[AGY] Install failed. You can also run VieNeu-TTS HTTP server and set VIENEU_TTS_URL in .env.")
            return res.returncode
        print("[AGY] VieNeu-TTS (`vieneu`) installed successfully!")
    else:
        print("[AGY] Prepared voices folder at:", voices_dir)
        print("To install VieNeu-TTS offline engine (~500-800MB weights downloaded on first use):")
        print("  1. Install eSpeak NG: winget install eSpeak-NG.eSpeak-NG")
        print("  2. Install SDK:       python scripts/setup-vieneu-tts.py --install")
        print("Or run a local VieNeu-TTS HTTP server and set VIENEU_TTS_URL=http://127.0.0.1:8008 in .env")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
