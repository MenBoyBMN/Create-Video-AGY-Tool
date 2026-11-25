#!/usr/bin/env python3
"""
AGY Video Studio — Local Offline VieNeu-TTS Adapter
Supports:
  1. Local HTTP API endpoint (VIENEU_TTS_URL, e.g. http://127.0.0.1:8008/tts)
  2. Official Python SDK (`from vieneu import Vieneu`) & legacy `VieNeuTTS`
     with cached engine instance across beats, automatic preset voice resolution,
     and Zero-shot Vietnamese Voice Cloning via `engine/audio/voices/<name>.wav`
"""
from __future__ import annotations

import inspect
import json
import os
import shutil
import urllib.request
from pathlib import Path
from typing import Any, Optional

_CACHED_ENGINE: Any = None
_CACHED_KEY: Optional[str] = None


def _desymlink_hf_onnx_snapshots() -> int:
    """
    On Windows with HF Hub symlinks enabled, ONNXRuntime rejects `.onnx` + `.data`
    files whose symlinks resolve into different `blobs/<xx>/` directories.
    Replace symlinks inside cached VieNeu / MOSS ONNX snapshot folders with
    hardlinks (zero extra disk space, copy fallback) so ONNXRuntime loads cleanly.
    """
    hub_root = Path.home() / ".cache" / "huggingface" / "hub"
    if not hub_root.exists():
        return 0
    fixed = 0
    for repo_name in (
        "models--pnnbao-ump--VieNeu-TTS-v3-Turbo",
        "models--OpenMOSS-Team--MOSS-Audio-Tokenizer-Nano-ONNX",
    ):
        snap_root = hub_root / repo_name / "snapshots"
        if not snap_root.exists():
            continue
        for item in snap_root.rglob("*"):
            if not item.is_symlink():
                continue
            try:
                real_src = item.resolve()
                if not real_src.is_file():
                    continue
                item.unlink()
                try:
                    os.link(real_src, item)
                except OSError:
                    shutil.copy2(real_src, item)
                fixed += 1
            except OSError:
                continue
    return fixed


class VieNeuTtsUnavailableError(RuntimeError):
    """Raised when VieNeu-TTS is not installed or local server is offline."""


def _resolve_clone_ref(voice_id: str, voices_dir: Path) -> tuple[Optional[Path], Optional[str]]:
    if not voice_id.startswith("clone:"):
        return None, None
    name = voice_id.split(":", 1)[1].strip()
    if not name or not voices_dir.exists():
        return None, None
    wav_path = voices_dir / f"{name}.wav"
    if not wav_path.exists():
        return None, None
    txt_path = voices_dir / f"{name}.txt"
    ref_text = txt_path.read_text(encoding="utf-8-sig").strip() if txt_path.exists() else ""
    return wav_path, ref_text


def _get_or_create_engine(mod: Any, model_dir: Optional[str]) -> Any:
    global _CACHED_ENGINE, _CACHED_KEY
    cache_key = f"{getattr(mod, '__name__', 'vieneu')}|{model_dir or ''}"
    if _CACHED_ENGINE is not None and _CACHED_KEY == cache_key:
        return _CACHED_ENGINE

    tts_cls = getattr(mod, "Vieneu", None) or getattr(mod, "VieNeuTTS", None)
    if tts_cls is None:
        raise VieNeuTtsUnavailableError("Installed VieNeu module missing Vieneu / VieNeuTTS class")

    kwargs: dict[str, Any] = {}
    if model_dir:
        try:
            sig = inspect.signature(tts_cls.__init__)
            if "model_dir" in sig.parameters:
                kwargs["model_dir"] = model_dir
        except (TypeError, ValueError):
            pass

    if os.name == "nt":
        _desymlink_hf_onnx_snapshots()

    try:
        _CACHED_ENGINE = tts_cls(**kwargs)
    except Exception as exc:  # noqa: BLE001
        if "External data path validation failed" in str(exc) and _desymlink_hf_onnx_snapshots() > 0:
            _CACHED_ENGINE = tts_cls(**kwargs)
        else:
            raise
    _CACHED_KEY = cache_key
    return _CACHED_ENGINE


def _resolve_preset_voice(engine: Any, clean_spec: str) -> Any:
    """Resolve `south-female`, `north-male`, or exact preset ID via `list_preset_voices` + `get_preset_voice`."""
    if not hasattr(engine, "get_preset_voice"):
        return clean_spec

    try:
        available = engine.list_preset_voices() if hasattr(engine, "list_preset_voices") else []
    except Exception:  # noqa: BLE001
        available = []

    if available:
        spec_low = clean_spec.lower()
        # 1. Exact ID match
        for item in available:
            desc, vid = (item[0], item[1]) if isinstance(item, (tuple, list)) and len(item) >= 2 else (str(item), str(item))
            if str(vid).lower() == spec_low:
                return engine.get_preset_voice(vid)

        # 2. Region / gender fuzzy match (south-female, north-male, etc.)
        want_south = "south" in spec_low or "nam" in spec_low
        want_north = "north" in spec_low or "bac" in spec_low
        want_female = "female" in spec_low or "nu" in spec_low
        want_male = "male" in spec_low and not want_female

        best_vid = None
        best_score = -1
        for item in available:
            desc, vid = (item[0], item[1]) if isinstance(item, (tuple, list)) and len(item) >= 2 else (str(item), str(item))
            hay = f"{desc} {vid}".lower()
            score = 0
            if want_south and any(k in hay for k in ("south", "miền nam", "mien nam", "saigon", "ngoc", "trinh", "tuyen", "doan")):
                score += 2
            if want_north and any(k in hay for k in ("north", "miền bắc", "mien bac", "hanoi", "binh", "dung", "son", "minh")):
                score += 2
            if want_female and any(k in hay for k in ("female", "nữ", "nu", "f_", "woman")):
                score += 2
            if want_male and any(k in hay for k in ("male", "nam", "m_", "man")) and "female" not in hay:
                score += 2
            if score > best_score:
                best_score = score
                best_vid = vid

        if best_vid is not None:
            return engine.get_preset_voice(best_vid)

    try:
        return engine.get_preset_voice(clean_spec)
    except Exception:  # noqa: BLE001
        return None


def _call_infer(
    engine: Any,
    text: str,
    voice_data: Any,
    ref_wav: Optional[Path],
    ref_text: Optional[str],
) -> Any:
    if not hasattr(engine, "infer"):
        raise VieNeuTtsUnavailableError("Unsupported VieNeu engine API (missing .infer)")

    try:
        params = set(inspect.signature(engine.infer).parameters.keys())
    except (TypeError, ValueError):
        params = set()

    kwargs: dict[str, Any] = {"text": text}
    if ref_wav is not None:
        if "reference_audio" in params:
            kwargs["reference_audio"] = str(ref_wav)
        elif "ref_audio" in params:
            kwargs["ref_audio"] = str(ref_wav)
        else:
            kwargs["reference_audio"] = str(ref_wav)

        if ref_text:
            if "reference_text" in params:
                kwargs["reference_text"] = ref_text
            elif "ref_text" in params:
                kwargs["ref_text"] = ref_text
    elif voice_data is not None and ("voice" in params or not params):
        kwargs["voice"] = voice_data

    return engine.infer(**kwargs)


def synthesize_vieneu_tts(
    text: str,
    voice_spec: str,
    out_wav: Path,
    voices_dir: Optional[Path] = None,
    server_url: Optional[str] = None,
    model_dir: Optional[str] = None,
) -> str:
    """
    Synthesize Vietnamese speech locally via VieNeu-TTS.
    `voice_spec` examples: `vieneu:north-male`, `vieneu:south-female`, `vieneu:clone:narrator`.
    """
    clean_spec = voice_spec.split(":", 1)[1] if voice_spec.startswith("vieneu:") else voice_spec
    clean_spec = clean_spec.strip() or "south-female"
    vdir = voices_dir or (Path(__file__).resolve().parent / "voices")
    ref_wav, ref_text = _resolve_clone_ref(clean_spec, vdir)

    url = (server_url or os.environ.get("VIENEU_TTS_URL") or "").strip()
    if url:
        endpoint = url.rstrip("/") + ("/tts" if not url.rstrip("/").endswith("/tts") else "")
        payload = json.dumps({
            "text": text,
            "voice": clean_spec,
            "ref_audio": str(ref_wav) if ref_wav else None,
            "ref_text": ref_text,
        }).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
                if len(data) < 200:
                    raise RuntimeError("VieNeu-TTS server returned empty audio")
                out_wav.parent.mkdir(parents=True, exist_ok=True)
                out_wav.write_bytes(data)
                return f"vieneu-http:{clean_spec}"
        except Exception as exc:  # noqa: BLE001
            raise VieNeuTtsUnavailableError(f"VieNeu-TTS server unreachable ({endpoint}): {exc}") from exc

    # Direct Python SDK (`vieneu` or `vieneu_tts`)
    try:
        import importlib

        mod = None
        for mod_name in ("vieneu", "vieneu_tts"):
            try:
                mod = importlib.import_module(mod_name)
                break
            except ImportError:
                continue

        if mod is None:
            raise VieNeuTtsUnavailableError(
                "VieNeu-TTS package not installed. Run `python scripts/setup-vieneu-tts.py --install` or set VIENEU_TTS_URL."
            )

        out_wav.parent.mkdir(parents=True, exist_ok=True)
        engine = _get_or_create_engine(mod, model_dir)
        voice_data = None if ref_wav is not None else _resolve_preset_voice(engine, clean_spec)
        audio = _call_infer(engine, text, voice_data, ref_wav, ref_text)

        if hasattr(engine, "save"):
            engine.save(audio, str(out_wav))
        else:
            import soundfile as sf  # type: ignore

            sf.write(str(out_wav), audio, 24000)
        return f"vieneu-local:{clean_spec}"
    except VieNeuTtsUnavailableError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise VieNeuTtsUnavailableError(f"VieNeu-TTS local inference failed: {exc}") from exc
