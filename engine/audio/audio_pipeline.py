#!/usr/bin/env python3
"""
AGY Video Studio — Audio-First Pipeline v2:
  1. Ensure 4-layer SFX (21+) & BGM (6+) library exists (prefer studio samples/ if dropped in)
  2. Hybrid TTS 4-Tier:
       - Gemini Native TTS (`gemini:<voice>`, expressive `voiceStyle` + Multi-Speaker `dialogue`)
       - VieNeu-TTS Local Offline (`vieneu:<voice>` or `vieneu:clone:<name>`)
       - Optional OpenAI / ElevenLabs via .env
       - Edge-TTS automatic resilient fallback (including multi-speaker Edge alternation)
  3. Word Aligner:
       - Faster-Whisper CUDA FP16 (RTX 3050) / CPU int8 mapped onto exact Vietnamese script tokens
       - Clean fallback to 10ms RMS valley aligner
  4. Broadcast FFmpeg Mastering (Vocal warmth/presence EQ + Compression + Sidechain Ducking + 2-pass -14 LUFS)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.request
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Allow sibling imports
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gemini_tts import GeminiQuotaError, GeminiTtsError, synthesize_gemini_tts  # noqa: E402
from sfx_generator import SR, ensure_sfx_library  # noqa: E402
from vieneu_tts import VieNeuTtsUnavailableError, synthesize_vieneu_tts  # noqa: E402
from whisper_aligner import (  # noqa: E402
    WhisperWordAligner,
    map_asr_to_script_tokens,
    normalize_token,
    strip_vocal_tags,
)

FPS_DEFAULT = 60
RMS_WIN_MS = 10
RMS_WIN_SAMPLES = int(SR * RMS_WIN_MS / 1000)


def sanitize_file_token(raw: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", str(raw or "")).strip("_") or "beat"


def resolve_project_dir(app_root: Path, project_slug: str) -> Path:
    projects_root = (app_root / "projects").resolve()
    candidate = (projects_root / project_slug).resolve()
    try:
        candidate.relative_to(projects_root)
    except ValueError as exc:
        raise ValueError(f"Invalid project path: {project_slug}") from exc
    if candidate == projects_root:
        raise ValueError(f"Invalid project path: {project_slug}")
    return candidate


def load_env_file(env_path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not env_path.exists():
        return env
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def run_ffmpeg(ffmpeg_bin: str, args: List[str]) -> subprocess.CompletedProcess:
    cmd = [ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error", *args]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg failed ({res.returncode}): {res.stderr.strip()}")
    return res


def synthesize_edge_tts(text: str, voice: str, rate: str, out_mp3: Path) -> None:
    import edge_tts

    clean_text = strip_vocal_tags(text) or text

    async def _run() -> None:
        comm = edge_tts.Communicate(text=clean_text, voice=voice, rate=rate or "+0%")
        await comm.save(str(out_mp3))

    last_err: Optional[Exception] = None
    for attempt in range(1, 5):
        try:
            asyncio.run(_run())
            if out_mp3.exists() and out_mp3.stat().st_size > 200:
                return
            raise RuntimeError("Edge-TTS returned empty audio file")
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if attempt < 4:
                time.sleep(0.8 * (2 ** (attempt - 1)))
    raise RuntimeError(f"Edge-TTS failed after 4 attempts: {last_err}")


def synthesize_openai_tts(text: str, api_key: str, voice: str, out_mp3: Path) -> None:
    clean_text = strip_vocal_tags(text) or text
    payload = json.dumps({
        "model": "tts-1-hd",
        "input": clean_text,
        "voice": voice or "alloy",
        "response_format": "mp3",
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        out_mp3.write_bytes(resp.read())


def synthesize_elevenlabs_tts(text: str, api_key: str, voice_id: str, out_mp3: Path) -> None:
    clean_text = strip_vocal_tags(text) or text
    vid = voice_id or "21m00Tcm4TlvDq8ikWAM"
    payload = json.dumps({
        "text": clean_text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.8},
    }).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
        data=payload,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        out_mp3.write_bytes(resp.read())


def read_wav_stereo(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wf:
        ch = wf.getnchannels()
        frames = wf.readframes(wf.getnframes())
        arr = np.frombuffer(frames, dtype=np.int16).astype(np.float64) / 32768.0
        if ch == 1:
            return np.stack([arr, arr], axis=1)
        return arr.reshape(-1, ch)[:, :2]


def write_wav_stereo(path: Path, data: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(data, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def _fallback_edge_voice(requested_voice: str, lang_hint: str = "vi-VN") -> str:
    if requested_voice and not requested_voice.startswith(("gemini:", "vieneu:", "openai:", "elevenlabs:")):
        return requested_voice
    if lang_hint.startswith("en"):
        return "en-US-AndrewNeural"
    return "vi-VN-NamMinhNeural" if "Charon" in requested_voice or "Fenrir" in requested_voice or "male" in requested_voice else "vi-VN-HoaiMyNeural"


def _synthesize_edge_dialogue(
    dialogue: List[Dict[str, Any]],
    speech_rate: str,
    ffmpeg_bin: str,
    beats_dir: Path,
    beat_id: str,
    out_wav: Path,
) -> List[Tuple[str, int]]:
    """
    Synthesize multi-speaker dialogue via Edge-TTS by alternating Vietnamese/English neural voices.
    Returns list of `(speaker, token_count)` in exact concatenation order.
    """
    segments: List[np.ndarray] = []
    speaker_token_counts: List[Tuple[str, int]] = []
    speaker_voice_map: Dict[str, str] = {}
    edge_cycle = ["vi-VN-NamMinhNeural", "vi-VN-HoaiMyNeural"]
    pause_samples = np.zeros((int(0.16 * SR), 2), dtype=np.float64)

    for idx, turn in enumerate(dialogue):
        sp = str(turn.get("speaker") or f"Speaker{idx + 1}").strip()
        txt = strip_vocal_tags(str(turn.get("text") or "").strip())
        if not txt:
            continue
        req_v = str(turn.get("voice") or "").strip()
        if req_v and not req_v.startswith(("gemini:", "vieneu:", "openai:", "elevenlabs:")):
            ev = req_v
        else:
            ev = speaker_voice_map.get(sp) or edge_cycle[len(speaker_voice_map) % len(edge_cycle)]
        speaker_voice_map[sp] = ev

        tmp_mp3 = beats_dir / f"{sanitize_file_token(beat_id)}_turn_{idx}.mp3"
        tmp_wav = beats_dir / f"{sanitize_file_token(beat_id)}_turn_{idx}.wav"
        synthesize_edge_tts(txt, ev, speech_rate, tmp_mp3)
        run_ffmpeg(ffmpeg_bin, ["-i", str(tmp_mp3), "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(tmp_wav)])
        segments.append(read_wav_stereo(tmp_wav))
        if idx < len(dialogue) - 1:
            segments.append(pause_samples)
        speaker_token_counts.append((sp, len([w for w in txt.split() if w])))
        for p in (tmp_mp3, tmp_wav):
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass

    if not segments:
        run_ffmpeg(
            ffmpeg_bin,
            ["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=stereo", "-t", "2.0", "-c:a", "pcm_s16le", str(out_wav)],
        )
    else:
        write_wav_stereo(out_wav, np.vstack(segments))
    return speaker_token_counts


def generate_beat_wav(
    beat: Dict[str, Any],
    voice: str,
    speech_rate: str,
    env: Dict[str, str],
    config: Dict[str, Any],
    ffmpeg_bin: str,
    beats_dir: Path,
    app_root: Path,
) -> Tuple[Path, str, List[Tuple[str, int]]]:
    beat_id = beat["id"]
    safe_beat_id = sanitize_file_token(beat_id)
    dialogue = beat.get("dialogue") or []
    narration = (beat.get("narration") or "").strip()
    if not narration and dialogue:
        narration = " ".join(str(t.get("text") or "").strip() for t in dialogue if t.get("text")).strip()

    out_wav = beats_dir / f"{safe_beat_id}_raw.wav"
    speaker_token_counts: List[Tuple[str, int]] = []
    if dialogue:
        for turn in dialogue:
            sp = str(turn.get("speaker") or "").strip()
            t_clean = strip_vocal_tags(str(turn.get("text") or "").strip())
            if sp and t_clean:
                speaker_token_counts.append((sp, len([w for w in t_clean.split() if w])))

    if not narration:
        dur = float(beat.get("durationHintSec") or 2.5)
        run_ffmpeg(
            ffmpeg_bin,
            ["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=stereo", "-t", f"{dur:.3f}", "-c:a", "pcm_s16le", str(out_wav)],
        )
        return out_wav, "silence", speaker_token_counts

    gemini_key = env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
    eleven_key = env.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVENLABS_API_KEY", "")
    openai_key = env.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    gemini_model = env.get("GEMINI_TTS_MODEL") or config.get("geminiTtsModel") or "gemini-3.8-flash-tts"
    voices_dir = app_root / "engine" / "audio" / "voices"

    # Tier 1: Gemini Native TTS (when `gemini:*` selected OR beat has `dialogue` with Gemini key present)
    wants_gemini = voice.startswith("gemini:") or (bool(dialogue) and bool(gemini_key))
    if wants_gemini:
        if gemini_key:
            tmp_gem = beats_dir / f"{safe_beat_id}_gemini.wav"
            try:
                used_mdl = synthesize_gemini_tts(
                    text=narration,
                    api_key=gemini_key,
                    voice_name=voice,
                    out_wav=tmp_gem,
                    model=gemini_model,
                    voice_style=beat.get("voiceStyle"),
                    dialogue=dialogue if dialogue else None,
                    language_code="en-US" if "en-" in voice else "vi-VN",
                )
                run_ffmpeg(
                    ffmpeg_bin,
                    ["-i", str(tmp_gem), "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(out_wav)],
                )
                tmp_gem.unlink(missing_ok=True)
                return out_wav, f"gemini:{used_mdl}", speaker_token_counts
            except (GeminiQuotaError, GeminiTtsError, Exception) as exc:  # noqa: BLE001
                print(f"[AGY Audio] Gemini TTS fallback for {beat_id}: {exc}", file=sys.stderr)
                tmp_gem.unlink(missing_ok=True)
        else:
            print(f"[AGY Audio] GEMINI_API_KEY not set; falling back from {voice} to local/Edge-TTS.", file=sys.stderr)

    # Tier 2: VieNeu-TTS Local Offline
    if voice.startswith("vieneu:"):
        tmp_vn = beats_dir / f"{safe_beat_id}_vieneu.wav"
        try:
            used_vn = synthesize_vieneu_tts(
                text=strip_vocal_tags(narration) or narration,
                voice_spec=voice,
                out_wav=tmp_vn,
                voices_dir=voices_dir,
                server_url=env.get("VIENEU_TTS_URL") or os.environ.get("VIENEU_TTS_URL"),
                model_dir=env.get("VIENEU_MODEL_DIR") or os.environ.get("VIENEU_MODEL_DIR"),
            )
            run_ffmpeg(
                ffmpeg_bin,
                ["-i", str(tmp_vn), "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(out_wav)],
            )
            tmp_vn.unlink(missing_ok=True)
            return out_wav, used_vn, speaker_token_counts
        except (VieNeuTtsUnavailableError, Exception) as exc:  # noqa: BLE001
            print(f"[AGY Audio] VieNeu-TTS unavailable for {beat_id}, falling back to Edge-TTS: {exc}", file=sys.stderr)
            tmp_vn.unlink(missing_ok=True)

    # Multi-speaker Edge fallback if dialogue exists
    if dialogue:
        sp_counts = _synthesize_edge_dialogue(dialogue, speech_rate, ffmpeg_bin, beats_dir, beat_id, out_wav)
        return out_wav, "edge-tts-dialogue", sp_counts

    # Tier 3/4: ElevenLabs / OpenAI / Edge-TTS
    raw_mp3 = beats_dir / f"{safe_beat_id}_tts.mp3"
    provider_used = "edge-tts"
    if voice.startswith("elevenlabs:") and eleven_key:
        synthesize_elevenlabs_tts(narration, eleven_key, voice.split(":", 1)[1] or env.get("ELEVENLABS_VOICE_ID", ""), raw_mp3)
        provider_used = "elevenlabs"
    elif voice.startswith("openai:") and openai_key:
        synthesize_openai_tts(narration, openai_key, voice.split(":", 1)[1] or env.get("OPENAI_TTS_VOICE", "alloy"), raw_mp3)
        provider_used = "openai"
    else:
        edge_voice = _fallback_edge_voice(voice)
        synthesize_edge_tts(narration, edge_voice, speech_rate, raw_mp3)
        provider_used = f"edge-tts:{edge_voice}"

    run_ffmpeg(
        ffmpeg_bin,
        ["-i", str(raw_mp3), "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(out_wav)],
    )
    try:
        raw_mp3.unlink(missing_ok=True)
    except OSError:
        pass
    return out_wav, provider_used, speaker_token_counts


def compute_rms_10ms(mono: np.ndarray) -> np.ndarray:
    n_win = max(1, len(mono) // RMS_WIN_SAMPLES)
    trimmed = mono[: n_win * RMS_WIN_SAMPLES].reshape(n_win, RMS_WIN_SAMPLES)
    return np.sqrt(np.mean(trimmed * trimmed, axis=1) + 1e-12)


def _expand_token_speakers(
    tokens: List[str], speaker_token_counts: List[Tuple[str, int]]
) -> List[Optional[str]]:
    if not speaker_token_counts:
        return [None] * len(tokens)
    out: List[Optional[str]] = []
    for sp, cnt in speaker_token_counts:
        out.extend([sp] * max(0, cnt))
    while len(out) < len(tokens):
        out.append(speaker_token_counts[-1][0])
    return out[: len(tokens)]


def align_beat_acoustic(
    raw_wav: Path,
    clean_wav: Path,
    narration: str,
    keywords: List[str],
    beat_start_frame: int,
    fps: int,
    whisper_aligner: Optional[WhisperWordAligner] = None,
    speaker_token_counts: Optional[List[Tuple[str, int]]] = None,
    language: str = "vi",
) -> Tuple[Dict[str, Any], np.ndarray, str]:
    """
    Analyze 10ms RMS waveform, trim dead silence cleanly, align word timings via Faster-Whisper
    (with seamless fallback to 10ms RMS valley snapping), and return exact 60fps BeatTiming.
    """
    stereo = read_wav_stereo(raw_wav)
    mono = 0.5 * (stereo[:, 0] + stereo[:, 1])
    rms = compute_rms_10ms(mono)
    peak_rms = float(np.max(rms)) if len(rms) else 0.0
    threshold = max(0.008, peak_rms * 0.06)

    active_idx = np.where(rms >= threshold)[0]
    if len(active_idx) > 0:
        first_ms = int(active_idx[0] * RMS_WIN_MS)
        last_ms = int((active_idx[-1] + 1) * RMS_WIN_MS)
        lead_pad_ms = 100
        tail_pad_ms = 220
        crop_start_ms = max(0, first_ms - lead_pad_ms)
        crop_end_ms = min(int(len(mono) * 1000 / SR), last_ms + tail_pad_ms)
        s0 = int(crop_start_ms * SR / 1000)
        s1 = max(s0 + int(0.4 * SR), int(crop_end_ms * SR / 1000))
        cropped = stereo[s0:s1]
        speech_start_ms = max(0, first_ms - crop_start_ms)
        speech_end_ms = max(speech_start_ms + 120, last_ms - crop_start_ms)
    else:
        cropped = stereo
        speech_start_ms = 80
        speech_end_ms = max(200, int(len(stereo) * 1000 / SR) - 80)

    dur_frames = max(30, int(math.ceil((len(cropped) / SR) * fps)))
    exact_samples = int(round((dur_frames / fps) * SR))
    if len(cropped) < exact_samples:
        pad = np.zeros((exact_samples - len(cropped), 2), dtype=np.float64)
        cropped = np.vstack([cropped, pad])
    else:
        cropped = cropped[:exact_samples]

    fade_n = min(int(0.005 * SR), len(cropped) // 4)
    if fade_n > 1:
        ramp = np.linspace(0.0, 1.0, fade_n)[:, None]
        cropped[:fade_n] *= ramp
        cropped[-fade_n:] *= ramp[::-1]

    write_wav_stereo(clean_wav, cropped)

    clean_narration = strip_vocal_tags(narration)
    tokens = [w for w in clean_narration.split() if w]
    keyword_set = {normalize_token(k) for k in keywords if normalize_token(k)}
    token_speakers = _expand_token_speakers(tokens, speaker_token_counts or [])
    words_out: List[Dict[str, Any]] = []
    aligner_used = "rms-10ms"

    if tokens and whisper_aligner is not None:
        try:
            asr_words = whisper_aligner.transcribe_words(clean_wav, language=language)
            words_out = map_asr_to_script_tokens(
                tokens=tokens,
                asr_words=asr_words,
                speech_start_ms=speech_start_ms,
                speech_end_ms=speech_end_ms,
                beat_start_frame=beat_start_frame,
                dur_frames=dur_frames,
                fps=fps,
                keyword_set=keyword_set,
                token_speakers=token_speakers,
            )
            aligner_used = f"faster-whisper:{whisper_aligner.active_device}-{whisper_aligner.compute_type}"
        except Exception as exc:  # noqa: BLE001
            print(f"[AGY Audio] Whisper alignment fallback to RMS for {clean_wav.stem}: {exc}", file=sys.stderr)
            words_out = []

    # Fallback: Acoustic 10ms RMS valley aligner
    if tokens and not words_out:
        cropped_mono = 0.5 * (cropped[:, 0] + cropped[:, 1])
        cropped_rms = compute_rms_10ms(cropped_mono)
        weights: List[float] = []
        for tok in tokens:
            base = max(1.5, float(len(normalize_token(tok)) or 1))
            if tok.endswith((".", "!", "?", ":")):
                base += 2.6
            elif tok.endswith((",", ";", "—", "-")):
                base += 1.4
            weights.append(base)
        total_w = sum(weights)
        speech_span_ms = max(120, speech_end_ms - speech_start_ms)

        boundaries_ms: List[float] = [float(speech_start_ms)]
        acc = 0.0
        for i in range(len(tokens) - 1):
            acc += weights[i]
            ideal_ms = speech_start_ms + (acc / total_w) * speech_span_ms
            win_center = int(round(ideal_ms / RMS_WIN_MS))
            win_lo = max(0, win_center - 7)
            win_hi = min(len(cropped_rms), win_center + 8)
            if win_hi > win_lo:
                local_min = win_lo + int(np.argmin(cropped_rms[win_lo:win_hi]))
                snapped_ms = float(local_min * RMS_WIN_MS)
                if snapped_ms > boundaries_ms[-1] + 40:
                    boundaries_ms.append(snapped_ms)
                else:
                    boundaries_ms.append(max(boundaries_ms[-1] + 40, ideal_ms))
            else:
                boundaries_ms.append(ideal_ms)
        boundaries_ms.append(float(speech_end_ms))

        prev_end = beat_start_frame
        beat_end_frame = beat_start_frame + dur_frames
        for idx, tok in enumerate(tokens):
            sf = beat_start_frame + int(round((boundaries_ms[idx] / 1000.0) * fps))
            ef = beat_start_frame + int(round((boundaries_ms[idx + 1] / 1000.0) * fps))
            sf = max(prev_end, min(beat_end_frame - 2, sf))
            ef = max(sf + 2, min(beat_end_frame, ef))
            prev_end = ef
            item: Dict[str, Any] = {
                "word": tok,
                "startFrame": sf,
                "endFrame": ef,
                "isKeyword": normalize_token(tok) in keyword_set,
            }
            if token_speakers[idx]:
                item["speaker"] = token_speakers[idx]
            words_out.append(item)

    beat_timing = {
        "id": clean_wav.stem,
        "startFrame": beat_start_frame,
        "endFrame": beat_start_frame + dur_frames,
        "durationFrames": dur_frames,
        "audioFile": f"audio/beats/{clean_wav.name}",
        "speechStartMs": int(speech_start_ms),
        "speechEndMs": int(speech_end_ms),
        "words": words_out,
    }
    return beat_timing, cropped, aligner_used


def master_audio_ffmpeg(
    ffmpeg_bin: str,
    voice_wav: Path,
    sfx_events: List[Tuple[Path, int, float]],
    bgm_wav: Optional[Path],
    bgm_volume: float,
    total_dur_sec: float,
    master_wav: Path,
) -> Dict[str, Any]:
    """
    Broadcast Studio Mastering Chain:
      - Voiceover bus -> highpass 75Hz + warmth (+1.5dB@180Hz) + presence (+1.8dB@3.2kHz) + gentle leveling compressor
      - BGM bus -> loop to total duration, Voice Carving EQ (-2dB@250Hz, -3dB@3000Hz), Sidechain Ducking
      - SFX cues -> adelay + volume mixed cleanly
      - 2-pass FFmpeg loudnorm (-14 LUFS / -1.0 dBTP / LRA 11)
    """
    premaster_wav = master_wav.parent / "_premaster.wav"
    inputs: List[str] = ["-i", str(voice_wav)]
    filter_parts: List[str] = [
        "[0:a]highpass=f=75,equalizer=f=180:t=q:w=1.2:g=1.5,equalizer=f=3200:t=q:w=1.4:g=1.8,"
        "acompressor=threshold=-20dB:ratio=2.2:attack=10:release=120,aresample=48000,asplit=2[vo_mix][vo_sc]"
    ]
    mix_labels: List[str] = ["[vo_mix]"]
    next_idx = 1

    if bgm_wav and bgm_wav.exists() and bgm_volume > 0.001:
        inputs.extend(["-stream_loop", "-1", "-i", str(bgm_wav)])
        fade_out_start = max(0.0, total_dur_sec - 0.8)
        filter_parts.append(
            f"[{next_idx}:a]atrim=0:{total_dur_sec:.3f},asetpts=PTS-STARTPTS,"
            f"equalizer=f=250:t=q:w=1.5:g=-2,equalizer=f=3000:t=q:w=1.5:g=-3,"
            f"volume={bgm_volume:.3f},afade=t=in:st=0:d=0.45,afade=t=out:st={fade_out_start:.3f}:d=0.75[bgm_eq]"
        )
        filter_parts.append(
            "[bgm_eq][vo_sc]sidechaincompress=threshold=0.025:ratio=4:attack=25:release=260:makeup=1[bgm_ducked]"
        )
        mix_labels.append("[bgm_ducked]")
        next_idx += 1
    else:
        filter_parts.append("[vo_sc]anullsink")

    for sfx_path, delay_ms, vol in sfx_events:
        if not sfx_path.exists():
            continue
        inputs.extend(["-i", str(sfx_path)])
        d_ms = max(0, int(delay_ms))
        label = f"[sfx_{next_idx}]"
        filter_parts.append(
            f"[{next_idx}:a]aresample=48000,volume={vol:.3f},adelay={d_ms}|{d_ms}{label}"
        )
        mix_labels.append(label)
        next_idx += 1

    if len(mix_labels) == 1:
        filter_parts.append(f"{mix_labels[0]}apad=whole_dur={total_dur_sec:.3f},atrim=0:{total_dur_sec:.3f}[premix]")
    else:
        filter_parts.append(
            f"{''.join(mix_labels)}amix=inputs={len(mix_labels)}:duration=first:dropout_transition=0:normalize=0,"
            f"alimiter=limit=0.95,atrim=0:{total_dur_sec:.3f}[premix]"
        )

    filter_complex = ";".join(filter_parts)
    run_ffmpeg(
        ffmpeg_bin,
        [
            *inputs,
            "-filter_complex",
            filter_complex,
            "-map",
            "[premix]",
            "-ar",
            str(SR),
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(premaster_wav),
        ],
    )

    measure_cmd = [
        ffmpeg_bin,
        "-hide_banner",
        "-i",
        str(premaster_wav),
        "-af",
        "loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json",
        "-f",
        "null",
        "-",
    ]
    m_res = subprocess.run(measure_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    measured: Dict[str, Any] = {}
    json_match = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", m_res.stderr)
    if json_match:
        try:
            measured = json.loads(json_match.group(0))
        except json.JSONDecodeError:
            measured = {}

    in_i = measured.get("input_i", "-inf")
    if measured and in_i != "-inf" and float(in_i) > -60.0:
        ln_filter = (
            f"loudnorm=I=-14:TP=-1.0:LRA=11:linear=true:"
            f"measured_I={measured['input_i']}:"
            f"measured_LRA={measured['input_lra']}:"
            f"measured_TP={measured['input_tp']}:"
            f"measured_thresh={measured['input_thresh']}:"
            f"offset={measured.get('target_offset', '0.0')}"
        )
    else:
        ln_filter = "loudnorm=I=-14:TP=-1.0:LRA=11"

    run_ffmpeg(
        ffmpeg_bin,
        [
            "-i",
            str(premaster_wav),
            "-af",
            ln_filter,
            "-ar",
            str(SR),
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(master_wav),
        ],
    )
    try:
        premaster_wav.unlink(missing_ok=True)
    except OSError:
        pass
    return measured


def extract_waveform_peaks(wav_path: Path, buckets: int = 240) -> List[float]:
    stereo = read_wav_stereo(wav_path)
    mono = np.abs(0.5 * (stereo[:, 0] + stereo[:, 1]))
    if len(mono) == 0:
        return [0.0] * buckets
    chunk = max(1, len(mono) // buckets)
    peaks: List[float] = []
    for i in range(buckets):
        s = i * chunk
        e = len(mono) if i == buckets - 1 else min(len(mono), (i + 1) * chunk)
        val = float(np.max(mono[s:e])) if e > s else 0.0
        peaks.append(round(val, 4))
    max_p = max(peaks) if peaks else 1.0
    if max_p > 1e-6:
        peaks = [round(min(1.0, p / max_p), 4) for p in peaks]
    return peaks


def _resolve_library_audio(sfx_dir: Path, name: str) -> Path:
    samples_dir = sfx_dir / "samples"
    for ext in (".wav", ".mp3"):
        cand = samples_dir / f"{name}{ext}"
        if cand.exists():
            return cand
    return sfx_dir / f"{name}.wav"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="AGY Video Studio Audio-First Pipeline v2")
    parser.add_argument("--app-root", required=True)
    parser.add_argument("--project", required=True)
    args = parser.parse_args()

    app_root = Path(args.app_root).resolve()
    project_dir = resolve_project_dir(app_root, args.project)
    storyboard_path = project_dir / "storyboard.json"
    if not storyboard_path.exists():
        raise FileNotFoundError(f"Storyboard not found: {storyboard_path}")

    config_path = app_root / "app.config.json"
    config = json.loads(config_path.read_text(encoding="utf-8-sig")) if config_path.exists() else {}
    env = load_env_file(app_root / ".env")
    ffmpeg_bin = config.get("ffmpegPath") or "ffmpeg"

    # 1. Ensure 4-layer SFX & BGM library
    sfx_dir = app_root / "engine" / "audio" / "sfx_library"
    ensure_sfx_library(sfx_dir, force=False)

    # 2. Parse storyboard
    storyboard = json.loads(storyboard_path.read_text(encoding="utf-8-sig"))
    fps = int(storyboard.get("fps") or config.get("fps") or FPS_DEFAULT)
    voice = storyboard.get("voice") or config.get("defaultVoice") or "vi-VN-HoaiMyNeural"
    speech_rate = storyboard.get("speechRate") or config.get("speechRate") or "+0%"
    beats: List[Dict[str, Any]] = storyboard.get("beats") or []
    if not beats:
        raise ValueError("Storyboard has no beats.")

    audio_dir = project_dir / "audio"
    beats_dir = audio_dir / "beats"
    beats_dir.mkdir(parents=True, exist_ok=True)

    aligner_mode = config.get("wordAligner") or "faster-whisper"
    whisper_aligner: Optional[WhisperWordAligner] = None
    if aligner_mode == "faster-whisper":
        whisper_aligner = WhisperWordAligner(
            model_size=str(config.get("whisperModel") or "small"),
            device=str(config.get("whisperDevice") or "auto"),
        )

    lang_code = "en" if "en-" in voice else "vi"

    # 3. Synthesize & align each beat
    beat_timings: List[Dict[str, Any]] = []
    voice_segments: List[np.ndarray] = []
    sfx_events: List[Tuple[Path, int, float]] = []
    providers_used: List[str] = []
    aligner_used = "rms-10ms"
    cursor_frame = 0

    try:
        for beat in beats:
            beat_id = beat["id"]
            safe_beat_id = sanitize_file_token(beat_id)
            dialogue = beat.get("dialogue") or []
            narration = (beat.get("narration") or "").strip()
            if not narration and dialogue:
                narration = " ".join(str(t.get("text") or "").strip() for t in dialogue if t.get("text")).strip()

            raw_wav, provider_used, sp_counts = generate_beat_wav(
                beat=beat,
                voice=voice,
                speech_rate=speech_rate,
                env=env,
                config=config,
                ffmpeg_bin=ffmpeg_bin,
                beats_dir=beats_dir,
                app_root=app_root,
            )
            if provider_used not in providers_used:
                providers_used.append(provider_used)

            clean_wav = beats_dir / f"{safe_beat_id}.wav"
            bt, cropped, used_align = align_beat_acoustic(
                raw_wav=raw_wav,
                clean_wav=clean_wav,
                narration=narration,
                keywords=beat.get("keywords") or [],
                beat_start_frame=cursor_frame,
                fps=fps,
                whisper_aligner=whisper_aligner,
                speaker_token_counts=sp_counts,
                language=lang_code,
            )
            bt["id"] = beat_id
            if used_align != "rms-10ms":
                aligner_used = used_align
            try:
                raw_wav.unlink(missing_ok=True)
            except OSError:
                pass

            beat_start_ms = int(round((cursor_frame / fps) * 1000.0))
            for cue in beat.get("sfx") or []:
                sfx_id = cue.get("id")
                if not sfx_id:
                    continue
                custom_sfx = project_dir / "assets" / f"{sfx_id}.wav"
                sfx_path = custom_sfx if custom_sfx.exists() else _resolve_library_audio(sfx_dir, sfx_id)
                offset_ms = int(cue.get("offsetMs") or 0)
                vol = float(cue.get("volume") if cue.get("volume") is not None else 0.55)
                sfx_events.append((sfx_path, max(0, beat_start_ms + offset_ms), vol))

            beat_timings.append(bt)
            voice_segments.append(cropped)
            cursor_frame = bt["endFrame"]
    finally:
        # Always free RTX 3050 CUDA VRAM before FFmpeg/Remotion stages
        if whisper_aligner is not None:
            whisper_aligner.close()

    total_frames = max(1, cursor_frame)
    total_dur_sec = round(total_frames / fps, 3)

    voice_concat = np.vstack(voice_segments)
    voice_bus_wav = audio_dir / "_voiceover_bus.wav"
    write_wav_stereo(voice_bus_wav, voice_concat)

    bgm_cfg = storyboard.get("bgm") or {}
    bgm_track = bgm_cfg.get("track") or config.get("defaultBgmTrack") or "bgm_ambient_tech"
    bgm_volume = float(
        bgm_cfg.get("volume") if bgm_cfg.get("volume") is not None else config.get("defaultBgmVolume", 0.16)
    )
    bgm_wav = None
    if bgm_track and bgm_track != "none":
        cand_project = project_dir / "assets" / bgm_track
        cand_lib = _resolve_library_audio(sfx_dir, bgm_track)
        bgm_wav = cand_project if cand_project.exists() else (cand_lib if cand_lib.exists() else None)

    # 4. Studio Mastering (-14 LUFS)
    master_wav = audio_dir / "master_audio.wav"
    loudness_stats = master_audio_ffmpeg(
        ffmpeg_bin=ffmpeg_bin,
        voice_wav=voice_bus_wav,
        sfx_events=sfx_events,
        bgm_wav=bgm_wav,
        bgm_volume=bgm_volume,
        total_dur_sec=total_dur_sec,
        master_wav=master_wav,
    )
    try:
        voice_bus_wav.unlink(missing_ok=True)
    except OSError:
        pass

    # 5. Extract waveform peaks & write timings.json
    peaks = extract_waveform_peaks(master_wav, buckets=240)
    timings = {
        "fps": fps,
        "totalFrames": total_frames,
        "totalDurationSec": total_dur_sec,
        "masterAudio": "audio/master_audio.wav",
        "waveformPeaks": peaks,
        "beats": beat_timings,
    }
    timings_path = project_dir / "timings.json"
    timings_path.write_text(json.dumps(timings, indent=2, ensure_ascii=False), encoding="utf-8")

    # 6. Sync project.json metadata
    project_json_path = project_dir / "project.json"
    if project_json_path.exists():
        meta = json.loads(project_json_path.read_text(encoding="utf-8-sig"))
        meta["durationSec"] = total_dur_sec
        meta["totalFrames"] = total_frames
        meta["beatCount"] = len(beat_timings)
        meta["voice"] = voice
        meta["bgmTrack"] = bgm_track
        meta["bgmVolume"] = bgm_volume
        meta["updatedAt"] = datetime.now(timezone.utc).astimezone().isoformat()
        project_json_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        json.dumps(
            {
                "ok": True,
                "project": args.project,
                "fps": fps,
                "totalFrames": total_frames,
                "totalDurationSec": total_dur_sec,
                "beatCount": len(beat_timings),
                "ttsProvidersUsed": providers_used,
                "alignerUsed": aligner_used,
                "timingsPath": str(timings_path),
                "masterAudioPath": str(master_wav),
                "loudness": loudness_stats,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
