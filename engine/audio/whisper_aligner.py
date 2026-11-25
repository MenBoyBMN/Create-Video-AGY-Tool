#!/usr/bin/env python3
"""
AGY Video Studio — Faster-Whisper Word-Level Aligner (CUDA FP16 on RTX 3050 / CPU int8 fallback)
Produces 60fps `words` timings mapped back onto exact storyboard tokens so Vietnamese spelling &
punctuation remain 100% intact while frame sync locks accurately to real speech articulation.
"""
from __future__ import annotations

import difflib
import gc
import math
import re
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy import signal


TAG_RE = re.compile(r"<(?:whisper|laugh|sigh|short pause|pause|breath|gasp|chuckle)[^>]*>", re.IGNORECASE)


def strip_vocal_tags(text: str) -> str:
    cleaned = TAG_RE.sub(" ", text or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def normalize_token(word: str) -> str:
    return re.sub(r"[^\w]", "", (word or "").lower(), flags=re.UNICODE)


class WhisperWordAligner:
    def __init__(self, model_size: str = "small", device: str = "auto") -> None:
        self.model_size = model_size or "small"
        self.requested_device = device or "auto"
        self._model: Any = None
        self.active_device: str = "uninitialized"
        self.compute_type: str = "unknown"

    def _load(self) -> None:
        if self._model is not None:
            return
        from faster_whisper import WhisperModel

        use_cuda = False
        if self.requested_device == "cuda":
            use_cuda = True
        elif self.requested_device == "auto":
            try:
                import ctranslate2

                use_cuda = ctranslate2.get_cuda_device_count() > 0
            except Exception:  # noqa: BLE001
                use_cuda = False

        if use_cuda:
            try:
                self._model = WhisperModel(self.model_size, device="cuda", compute_type="float16")
                self.active_device = "cuda"
                self.compute_type = "float16"
                return
            except Exception:  # noqa: BLE001
                # Missing CUDA runtime DLLs (e.g. cublas64_12) or low VRAM -> fallback CPU int8
                pass

        self._model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
        self.active_device = "cpu"
        self.compute_type = "int8"

    def close(self) -> None:
        if self._model is not None:
            del self._model
            self._model = None
            gc.collect()

    @staticmethod
    def _load_audio_16k(wav_path: Path) -> np.ndarray:
        with wave.open(str(wav_path), "rb") as wf:
            sr = wf.getframerate()
            ch = wf.getnchannels()
            frames = wf.readframes(wf.getnframes())
        arr = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        if ch > 1:
            arr = arr.reshape(-1, ch).mean(axis=1)
        if sr != 16000 and len(arr) > 0:
            g = math.gcd(sr, 16000)
            arr = signal.resample_poly(arr, 16000 // g, sr // g).astype(np.float32)
        return np.clip(arr, -1.0, 1.0)

    def _extract_words(self, audio_16k: np.ndarray, language: str) -> List[Tuple[str, float, float]]:
        segments, _info = self._model.transcribe(
            audio_16k,
            language=language or None,
            word_timestamps=True,
            vad_filter=True,
            beam_size=2,
        )
        extracted: List[Tuple[str, float, float]] = []
        for seg in segments:
            for w in getattr(seg, "words", None) or []:
                tok = (w.word or "").strip()
                if tok:
                    extracted.append((tok, float(w.start), float(w.end)))
        return extracted

    def transcribe_words(self, wav_path: Path, language: str = "vi") -> List[Tuple[str, float, float]]:
        self._load()
        audio_16k = self._load_audio_16k(wav_path)
        try:
            return self._extract_words(audio_16k, language)
        except Exception as exc:  # noqa: BLE001
            # If CUDA fails mid-inference (e.g. missing cublas DLL at kernel launch), retry once on CPU
            if self.active_device == "cuda":
                self.close()
                self.requested_device = "cpu"
                self._load()
                return self._extract_words(audio_16k, language)
            raise exc


def map_asr_to_script_tokens(
    tokens: List[str],
    asr_words: List[Tuple[str, float, float]],
    speech_start_ms: int,
    speech_end_ms: int,
    beat_start_frame: int,
    dur_frames: int,
    fps: int,
    keyword_set: set[str],
    token_speakers: Optional[List[Optional[str]]] = None,
) -> List[Dict[str, Any]]:
    """
    Map Whisper ASR word timestamps back onto exact `tokens` via SequenceMatcher,
    preserving 100% original Vietnamese spelling while locking real acoustic timing.
    """
    if not tokens:
        return []

    n = len(tokens)
    starts_ms: List[Optional[float]] = [None] * n
    ends_ms: List[Optional[float]] = [None] * n

    if asr_words:
        norm_script = [normalize_token(t) for t in tokens]
        norm_asr = [normalize_token(w[0]) for w in asr_words]
        matcher = difflib.SequenceMatcher(None, norm_script, norm_asr, autojunk=False)
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1)):
                for k in range(i2 - i1):
                    si = i1 + k
                    aj = j1 + k
                    starts_ms[si] = asr_words[aj][1] * 1000.0
                    ends_ms[si] = asr_words[aj][2] * 1000.0
            elif tag == "replace" and (i2 - i1) > 0 and (j2 - j1) > 0:
                span_s = asr_words[j1][1] * 1000.0
                span_e = asr_words[j2 - 1][2] * 1000.0
                count = i2 - i1
                step = max(40.0, (span_e - span_s) / count)
                for k in range(count):
                    starts_ms[i1 + k] = span_s + k * step
                    ends_ms[i1 + k] = span_s + (k + 1) * step

    # Interpolate any missing token timestamps smoothly between known neighbors
    known = [idx for idx, s in enumerate(starts_ms) if s is not None]
    if not known:
        total_span = max(120.0, float(speech_end_ms - speech_start_ms))
        step = total_span / n
        for idx in range(n):
            starts_ms[idx] = speech_start_ms + idx * step
            ends_ms[idx] = speech_start_ms + (idx + 1) * step
    else:
        first_k = known[0]
        if first_k > 0:
            anchor = float(starts_ms[first_k] or speech_start_ms)
            lo = min(float(speech_start_ms), max(0.0, anchor - first_k * 180.0))
            step = max(35.0, (anchor - lo) / first_k)
            for idx in range(first_k):
                starts_ms[idx] = lo + idx * step
                ends_ms[idx] = lo + (idx + 1) * step

        for pos in range(len(known) - 1):
            a, b = known[pos], known[pos + 1]
            if b - a > 1:
                t0 = float(ends_ms[a] or starts_ms[a] or 0.0)
                t1 = float(starts_ms[b] or t0 + (b - a) * 60.0)
                step = max(35.0, (t1 - t0) / (b - a - 1))
                for idx in range(a + 1, b):
                    offset = idx - a - 1
                    starts_ms[idx] = t0 + offset * step
                    ends_ms[idx] = t0 + (offset + 1) * step

        last_k = known[-1]
        if last_k < n - 1:
            t0 = float(ends_ms[last_k] or starts_ms[last_k] or speech_start_ms)
            t1 = max(t0 + (n - 1 - last_k) * 80.0, float(speech_end_ms))
            step = max(35.0, (t1 - t0) / (n - 1 - last_k))
            for idx in range(last_k + 1, n):
                offset = idx - last_k - 1
                starts_ms[idx] = t0 + offset * step
                ends_ms[idx] = t0 + (offset + 1) * step

    words_out: List[Dict[str, Any]] = []
    prev_end = beat_start_frame
    beat_end_frame = beat_start_frame + dur_frames
    for idx, tok in enumerate(tokens):
        s_ms = float(starts_ms[idx] or speech_start_ms)
        e_ms = float(ends_ms[idx] or (s_ms + 120.0))
        sf = beat_start_frame + int(round((s_ms / 1000.0) * fps))
        ef = beat_start_frame + int(round((e_ms / 1000.0) * fps))
        sf = max(prev_end, min(beat_end_frame - 2, sf))
        ef = max(sf + 2, min(beat_end_frame, ef))
        prev_end = ef
        item: Dict[str, Any] = {
            "word": tok,
            "startFrame": sf,
            "endFrame": ef,
            "isKeyword": normalize_token(tok) in keyword_set,
        }
        if token_speakers and idx < len(token_speakers) and token_speakers[idx]:
            item["speaker"] = token_speakers[idx]
        words_out.append(item)

    return words_out
