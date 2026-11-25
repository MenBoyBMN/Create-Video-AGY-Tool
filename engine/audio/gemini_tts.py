#!/usr/bin/env python3
"""
AGY Video Studio — Gemini Native Speech Generation (TTS) Adapter
Supports:
  - Expressive single-speaker TTS with natural-language style direction (`voiceStyle`)
    and inline vocal tags (<whisper>, <laugh>, <sigh>, <short pause>)
  - Multi-speaker dialogue generation (`dialogue` array) in a single pass
  - Automatic model fallback + clean QuotaError signaling for hybrid fallback
"""
from __future__ import annotations

import os
import re
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional


class GeminiTtsError(RuntimeError):
    """Base error for Gemini TTS synthesis."""


class GeminiQuotaError(GeminiTtsError):
    """Raised when Gemini API free-tier quota or rate limit is reached."""


DEFAULT_MODELS = [
    "gemini-3.8-flash-tts",
    "gemini-3.8-flash-lite-tts",
    "gemini-2.5-flash-preview-tts",
]

GEMINI_PREBUILT_VOICES = [
    "Puck",
    "Kore",
    "Charon",
    "Fenrir",
    "Aoede",
    "Leda",
    "Orus",
    "Zephyr",
]


def _save_pcm_or_wav(raw_bytes: bytes, mime_type: str, out_wav: Path) -> None:
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    if raw_bytes[:4] == b"RIFF" and b"WAVE" in raw_bytes[:16]:
        out_wav.write_bytes(raw_bytes)
        return

    sample_rate = 24000
    rate_match = re.search(r"rate=(\d+)", mime_type or "")
    if rate_match:
        sample_rate = int(rate_match.group(1))

    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(raw_bytes)


def _extract_audio_part(response: Any) -> Optional[tuple[bytes, str]]:
    candidates = getattr(response, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                data = inline.data
                if isinstance(data, str):
                    import base64

                    data = base64.b64decode(data)
                mime = getattr(inline, "mime_type", "") or "audio/L16;rate=24000"
                return bytes(data), mime
    return None


def synthesize_gemini_tts(
    text: str,
    api_key: str,
    voice_name: str,
    out_wav: Path,
    model: Optional[str] = None,
    voice_style: Optional[str] = None,
    dialogue: Optional[List[Dict[str, Any]]] = None,
    language_code: str = "vi-VN",
) -> str:
    """
    Synthesize speech via Gemini TTS API into `out_wav`.
    Returns the model ID that succeeded.
    """
    if not api_key:
        raise GeminiTtsError("Missing GEMINI_API_KEY")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    models_to_try: List[str] = []
    if model:
        models_to_try.append(model.strip())
    for m in DEFAULT_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    if dialogue and len(dialogue) > 0:
        # Build multi-speaker prompt + voice map (Gemini supports 2+ distinct speakers)
        speaker_voices: Dict[str, str] = {}
        fallback_cycle = ["Puck", "Kore", "Charon", "Aoede"]
        prompt_lines: List[str] = []
        for idx, turn in enumerate(dialogue):
            sp = str(turn.get("speaker") or f"Speaker{idx + 1}").strip()
            v = str(turn.get("voice") or "").strip()
            if v.startswith("gemini:"):
                v = v.split(":", 1)[1]
            if not v:
                v = speaker_voices.get(sp) or fallback_cycle[len(speaker_voices) % len(fallback_cycle)]
            speaker_voices[sp] = v
            t_style = str(turn.get("style") or "").strip()
            t_text = str(turn.get("text") or "").strip()
            if t_style:
                prompt_lines.append(f"{sp} ({t_style}): {t_text}")
            else:
                prompt_lines.append(f"{sp}: {t_text}")

        # Ensure at least 2 speakers in multi_speaker_voice_config if only 1 unique name appeared
        if len(speaker_voices) == 1:
            speaker_voices["Host B"] = "Kore" if list(speaker_voices.values())[0] != "Kore" else "Puck"

        speaker_configs = [
            types.SpeakerVoiceConfig(
                speaker=sp,
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=v)
                ),
            )
            for sp, v in list(speaker_voices.items())[:2]
        ]
        speech_cfg = types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=speaker_configs
            ),
            language_code=language_code,
        )
        prompt_text = (
            "Đọc tự nhiên, truyền cảm đúng vai nhân vật và phong thái được ghi chú:\n"
            + "\n".join(prompt_lines)
        )
    else:
        clean_voice = (voice_name or "Puck").strip()
        if clean_voice.startswith("gemini:"):
            clean_voice = clean_voice.split(":", 1)[1] or "Puck"
        speech_cfg = types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=clean_voice)
            ),
            language_code=language_code,
        )
        if voice_style:
            prompt_text = f"[Diễn xuất: {voice_style.strip()}]\n{text}"
        else:
            prompt_text = text

    last_err: Optional[Exception] = None
    for mdl in models_to_try:
        try:
            resp = client.models.generate_content(
                model=mdl,
                contents=prompt_text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=speech_cfg,
                ),
            )
            extracted = _extract_audio_part(resp)
            if not extracted:
                raise GeminiTtsError(f"Gemini model {mdl} returned no audio payload")
            raw_bytes, mime = extracted
            _save_pcm_or_wav(raw_bytes, mime, out_wav)
            return mdl
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).lower()
            if "429" in msg or "quota" in msg or "resource_exhausted" in msg or "rate" in msg:
                raise GeminiQuotaError(f"Gemini TTS quota/rate limit reached ({mdl}): {exc}") from exc
            if "404" in msg or "not found" in msg or "unsupported" in msg or "deprecated" in msg:
                last_err = exc
                continue
            last_err = exc
            break

    raise GeminiTtsError(f"Gemini TTS failed: {last_err}")
