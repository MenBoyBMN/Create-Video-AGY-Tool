#!/usr/bin/env python3
"""
AGY Video Studio — Procedural 4-Layer SFX & Loopable BGM Synthesizer (48kHz 16-bit Stereo WAV)
Layers: Body, Movement, Detail, Emotion + BGM
"""
from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from scipy import signal

SR = 48000

SFX_CATALOG: List[Dict[str, str]] = [
    # Body
    {"id": "sub_impact", "layer": "Body", "description": "Deep punchy sub-bass impact for hooks and reveals"},
    {"id": "bass_drop", "layer": "Body", "description": "Warm descending bass drop for heavy transitions"},
    {"id": "deep_boom", "layer": "Body", "description": "Cinematic trailer boom with filtered dark tail"},
    {"id": "cinematic_braam", "layer": "Body", "description": "Wide brassy cinematic trailer braam swell"},
    # Movement
    {"id": "whoosh_fast", "layer": "Movement", "description": "Crisp stereo L-to-R bandpass whoosh"},
    {"id": "whoosh_soft", "layer": "Movement", "description": "Smooth airy transition whoosh"},
    {"id": "swoosh_rise", "layer": "Movement", "description": "Upward sweeping motion swell"},
    {"id": "whip_pan", "layer": "Movement", "description": "Ultra-fast snap pan transition swish"},
    {"id": "tape_rewind", "layer": "Movement", "description": "Retro VHS tape rewind flutter effect"},
    # Detail
    {"id": "pop", "layer": "Detail", "description": "Snappy tactile UI pop for badges and cards"},
    {"id": "click_ui", "layer": "Detail", "description": "Crisp micro UI click for steps and counters"},
    {"id": "chime_ping", "layer": "Detail", "description": "Glassy harmonic bell ping for highlights"},
    {"id": "type_tick", "layer": "Detail", "description": "Subtle mechanical key tick"},
    {"id": "camera_shutter", "layer": "Detail", "description": "Crisp mechanical SLR shutter snap for photo reveals"},
    {"id": "paper_flip", "layer": "Detail", "description": "Tactile magazine/newspaper page turn"},
    {"id": "chalk_write", "layer": "Detail", "description": "Sketchbook pencil/chalk stroke scratch"},
    {"id": "glitch_zap", "layer": "Detail", "description": "Digital static zap for glitch cuts & Y2K"},
    # Emotion
    {"id": "riser_tension", "layer": "Emotion", "description": "Building tension sweep leading into climax"},
    {"id": "shimmer_reveal", "layer": "Emotion", "description": "Warm stereo major-9th shimmer pad swell"},
    {"id": "success_chord", "layer": "Emotion", "description": "Resolved bright studio chord for CTA/outro"},
    {"id": "bell_soft", "layer": "Emotion", "description": "Warm nostalgic Rhodes-like bell resonance"},
]

BGM_CATALOG: List[Dict[str, str]] = [
    {"id": "bgm_ambient_tech", "layer": "BGM", "description": "Warm dark-tech ambient synth pad & subtle pulse (loopable)"},
    {"id": "bgm_editorial_pulse", "layer": "BGM", "description": "Clean editorial documentary pulse & warm pad (loopable)"},
    {"id": "bgm_upbeat_kinetic", "layer": "BGM", "description": "Energetic 120 BPM kinetic rhythm bed for Shorts/Reels (loopable)"},
    {"id": "bgm_lofi_warm", "layer": "BGM", "description": "Warm Rhodes lo-fi nostalgia bed with gentle vinyl texture (loopable)"},
    {"id": "bgm_noir_tension", "layer": "BGM", "description": "Suspenseful low-pulse documentary/True Crime tension bed (loopable)"},
    {"id": "bgm_cinematic_piano", "layer": "BGM", "description": "Warm felt-piano & strings emotional storytelling bed (loopable)"},
]


def _normalize_stereo(left: np.ndarray, right: np.ndarray, peak: float = 0.88) -> np.ndarray:
    stereo = np.stack([left, right], axis=1).astype(np.float64)
    max_val = float(np.max(np.abs(stereo))) if stereo.size else 0.0
    if max_val > 1e-9:
        stereo = stereo * (peak / max_val)
    return np.clip(stereo, -1.0, 1.0)


def _write_wav(path: Path, stereo: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(stereo, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def _butter(data: np.ndarray, cutoff, btype: str = "low", order: int = 3) -> np.ndarray:
    nyq = 0.5 * SR
    if isinstance(cutoff, (tuple, list)):
        wn = [max(1e-4, min(0.999, c / nyq)) for c in cutoff]
    else:
        wn = max(1e-4, min(0.999, cutoff / nyq))
    b, a = signal.butter(order, wn, btype=btype)
    return signal.lfilter(b, a, data)


def _synth_sub_impact() -> np.ndarray:
    dur = 0.85
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    freq = 34.0 + 78.0 * np.exp(-t * 14.0)
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    sub = np.sin(phase) * np.exp(-t * 4.6)
    click = np.sin(2.0 * np.pi * 190.0 * t) * np.exp(-t * 55.0) * 0.45
    rng = np.random.default_rng(101)
    thump_noise = _butter(rng.standard_normal(len(t)), 260, "low") * np.exp(-t * 12.0) * 0.5
    left = sub + click + thump_noise
    right = sub + click + _butter(rng.standard_normal(len(t)), 240, "low") * np.exp(-t * 11.5) * 0.5
    return _normalize_stereo(left, right, 0.92)


def _synth_bass_drop() -> np.ndarray:
    dur = 1.35
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    freq = 28.0 + 68.0 * np.exp(-t * 2.8)
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    env = np.minimum(1.0, t / 0.015) * np.exp(-t * 2.1)
    core = np.tanh(1.6 * np.sin(phase)) * env
    harm = np.sin(phase * 2.0 + 0.15) * env * 0.22
    return _normalize_stereo(core + harm, core + np.sin(phase * 2.0 - 0.15) * env * 0.22, 0.90)


def _synth_deep_boom() -> np.ndarray:
    dur = 1.6
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(202)
    freq = 32.0 + 56.0 * np.exp(-t * 8.0)
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    sub = np.sin(phase) * np.exp(-t * 2.5)
    rumble_l = _butter(rng.standard_normal(len(t)), (40, 220), "band") * np.exp(-t * 2.4) * 1.4
    rumble_r = _butter(rng.standard_normal(len(t)), (45, 240), "band") * np.exp(-t * 2.3) * 1.4
    return _normalize_stereo(sub + rumble_l, sub + rumble_r, 0.92)


def _synth_whoosh(dur: float, seed: int, f_peak: float, pan_sweep: bool = True) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(seed)
    noise_l = rng.standard_normal(n)
    noise_r = rng.standard_normal(n)
    env = np.sin(np.pi * (t / dur)) ** 1.7
    # Multi-band blend for silky dynamic sweep
    lo_l = _butter(noise_l, (180, 700), "band")
    hi_l = _butter(noise_l, (800, f_peak), "band")
    lo_r = _butter(noise_r, (180, 700), "band")
    hi_r = _butter(noise_r, (800, f_peak), "band")
    sweep = np.sin(np.pi * (t / dur)) ** 2.2
    sig_l = (lo_l * (1.0 - 0.4 * sweep) + hi_l * sweep * 1.3) * env
    sig_r = (lo_r * (1.0 - 0.4 * sweep) + hi_r * sweep * 1.3) * env
    if pan_sweep:
        pan = t / dur
        sig_l *= np.cos(pan * np.pi * 0.42)
        sig_r *= np.sin(pan * np.pi * 0.42 + 0.15)
    return _normalize_stereo(sig_l, sig_r, 0.85)


def _synth_swoosh_rise() -> np.ndarray:
    dur = 0.65
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(303)
    env = (t / dur) ** 1.4 * np.exp(-np.maximum(0, t - dur * 0.82) * 28.0)
    air_l = _butter(rng.standard_normal(len(t)), (350, 3400), "band") * env
    air_r = _butter(rng.standard_normal(len(t)), (380, 3600), "band") * env
    tone_f = 220.0 + 660.0 * (t / dur) ** 2
    tone = np.sin(2.0 * np.pi * np.cumsum(tone_f) / SR) * env * 0.25
    return _normalize_stereo(air_l + tone, air_r + tone, 0.82)


def _synth_pop() -> np.ndarray:
    dur = 0.16
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    freq = 180.0 + 480.0 * np.exp(-t * 48.0)
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    env = np.minimum(1.0, t / 0.004) * np.exp(-t * 28.0)
    sig = np.sin(phase) * env
    return _normalize_stereo(sig, sig * 0.96, 0.84)


def _synth_click_ui() -> np.ndarray:
    dur = 0.08
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    sig = (
        np.sin(2.0 * np.pi * 2400.0 * t) * 0.65
        + np.sin(2.0 * np.pi * 4100.0 * t) * 0.35
    ) * np.exp(-t * 110.0)
    return _normalize_stereo(sig, sig, 0.8)


def _synth_chime_ping() -> np.ndarray:
    dur = 0.95
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    env = np.minimum(1.0, t / 0.005) * np.exp(-t * 4.2)
    l = (
        np.sin(2.0 * np.pi * 880.0 * t) * 0.6
        + np.sin(2.0 * np.pi * 1318.5 * t) * 0.3
        + np.sin(2.0 * np.pi * 2637.0 * t) * 0.12
    ) * env
    r = (
        np.sin(2.0 * np.pi * 881.5 * t) * 0.6
        + np.sin(2.0 * np.pi * 1320.0 * t) * 0.3
        + np.sin(2.0 * np.pi * 2634.0 * t) * 0.12
    ) * env
    return _normalize_stereo(l, r, 0.78)


def _synth_type_tick() -> np.ndarray:
    dur = 0.05
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(404)
    n = _butter(rng.standard_normal(len(t)), (1400, 5200), "band")
    sig = n * np.exp(-t * 160.0)
    return _normalize_stereo(sig, sig, 0.75)


def _synth_riser_tension() -> np.ndarray:
    dur = 2.0
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(505)
    prog = t / dur
    env = (prog ** 1.8) * np.exp(-np.maximum(0, t - dur * 0.93) * 40.0)
    f1 = 110.0 * (2.0 ** (prog * 2.2))
    f2 = 165.0 * (2.0 ** (prog * 2.2))
    p1 = 2.0 * np.pi * np.cumsum(f1) / SR
    p2 = 2.0 * np.pi * np.cumsum(f2) / SR
    synth = (np.sin(p1) + 0.55 * np.sin(p2)) * env * 0.55
    air_l = _butter(rng.standard_normal(len(t)), (500, 4800), "band") * env * 0.5
    air_r = _butter(rng.standard_normal(len(t)), (550, 5100), "band") * env * 0.5
    return _normalize_stereo(synth + air_l, synth + air_r, 0.84)


def _synth_shimmer_reveal() -> np.ndarray:
    dur = 1.65
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    env = np.sin(np.pi * (t / dur) ** 0.75) ** 1.4
    notes = [261.63, 329.63, 392.00, 493.88, 587.33]  # Cmaj9
    l = np.zeros_like(t)
    r = np.zeros_like(t)
    for i, f in enumerate(notes):
        detune = (i - 2) * 0.6
        l += np.sin(2.0 * np.pi * (f + detune) * t) / len(notes)
        r += np.sin(2.0 * np.pi * (f - detune) * t) / len(notes)
    return _normalize_stereo(l * env, r * env, 0.76)


def _synth_success_chord() -> np.ndarray:
    dur = 1.4
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    notes = [523.25, 659.25, 783.99, 987.77, 1174.66]
    l = np.zeros_like(t)
    r = np.zeros_like(t)
    for idx, f in enumerate(notes):
        delay = idx * 0.035
        dt = np.maximum(0.0, t - delay)
        mask = (t >= delay).astype(np.float64)
        env = mask * np.minimum(1.0, dt / 0.008) * np.exp(-dt * 2.9)
        l += np.sin(2.0 * np.pi * (f + 0.4) * dt) * env
        r += np.sin(2.0 * np.pi * (f - 0.4) * dt) * env
    return _normalize_stereo(l, r, 0.78)


def _synth_bgm_ambient_tech() -> np.ndarray:
    """16-second seamlessly loopable dark-tech ambient pad + soft rhythmic pulse."""
    dur = 16.0
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    chords = [
        [220.00, 261.63, 329.63, 392.00],  # Am7
        [174.61, 220.00, 261.63, 329.63],  # Fmaj7
        [130.81, 196.00, 246.94, 329.63],  # Cmaj7
        [196.00, 246.94, 293.66, 392.00],  # G6
    ]
    l = np.zeros(n, dtype=np.float64)
    r = np.zeros(n, dtype=np.float64)
    seg_len = n // 4
    for idx, freqs in enumerate(chords):
        s = idx * seg_len
        e = n if idx == 3 else (idx + 1) * seg_len
        tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
        fade = np.minimum(1.0, tt / 0.35) * np.minimum(1.0, ((e - s) / SR - tt) / 0.35)
        pad_l = np.zeros_like(tt)
        pad_r = np.zeros_like(tt)
        for f in freqs:
            pad_l += np.sin(2.0 * np.pi * (f + 0.35) * tt) + 0.25 * np.sin(4.0 * np.pi * f * tt)
            pad_r += np.sin(2.0 * np.pi * (f - 0.35) * tt) + 0.25 * np.sin(4.0 * np.pi * f * tt)
        l[s:e] += pad_l * fade * 0.22
        r[s:e] += pad_r * fade * 0.22
        # Soft sub foundation
        root = freqs[0] * 0.5
        pulse = 0.55 + 0.45 * np.sin(2.0 * np.pi * 1.0 * tt)
        sub = np.sin(2.0 * np.pi * root * tt) * fade * pulse * 0.35
        l[s:e] += sub
        r[s:e] += sub

    # Gentle arpeggio shimmer (8th notes at 120 BPM = 0.25s)
    arp_notes = [440.0, 523.25, 659.25, 783.99]
    step_samples = int(SR * 0.25)
    for k in range(int(dur / 0.25)):
        s = k * step_samples
        e = min(n, s + step_samples)
        tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
        f = arp_notes[k % len(arp_notes)]
        env = np.minimum(1.0, tt / 0.008) * np.exp(-tt * 9.5)
        note = np.sin(2.0 * np.pi * f * tt) * env * 0.14
        pan = 0.35 + 0.3 * (k % 2)
        l[s:e] += note * pan
        r[s:e] += note * (1.0 - pan)

    l = _butter(l, 2800, "low")
    r = _butter(r, 2800, "low")
    return _normalize_stereo(l, r, 0.72)


def _synth_bgm_editorial_pulse() -> np.ndarray:
    """16-second minimal documentary/editorial rhythmic bed."""
    dur = 16.0
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    l = np.zeros(n, dtype=np.float64)
    r = np.zeros(n, dtype=np.float64)
    # Warm drone
    drone = (
        np.sin(2.0 * np.pi * 110.0 * t) * 0.32
        + np.sin(2.0 * np.pi * 164.81 * t) * 0.22
        + np.sin(2.0 * np.pi * 220.0 * t) * 0.18
    ) * (0.85 + 0.15 * np.sin(2.0 * np.pi * 0.125 * t))
    l += drone
    r += drone
    # Soft editorial pluck every 0.5s
    scale = [329.63, 392.00, 440.00, 493.88, 392.00, 329.63, 293.66, 329.63]
    step = int(SR * 0.5)
    for k in range(int(dur / 0.5)):
        s = k * step
        e = min(n, s + step)
        tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
        f = scale[k % len(scale)]
        pluck = np.sin(2.0 * np.pi * f * tt) * np.minimum(1.0, tt / 0.006) * np.exp(-tt * 7.5) * 0.24
        l[s:e] += pluck * (0.6 if k % 2 == 0 else 0.4)
        r[s:e] += pluck * (0.4 if k % 2 == 0 else 0.6)
    l = _butter(l, 2400, "low")
    r = _butter(r, 2400, "low")
    return _normalize_stereo(l, r, 0.70)


def _synth_bgm_upbeat_kinetic() -> np.ndarray:
    """16-second energetic 120 BPM kinetic bed for Shorts/Reels."""
    dur = 16.0
    n = int(SR * dur)
    l = np.zeros(n, dtype=np.float64)
    r = np.zeros(n, dtype=np.float64)
    rng = np.random.default_rng(707)
    beat_s = int(SR * 0.5)  # 120 BPM quarter note
    bass_notes = [110.0, 110.0, 130.81, 146.83]
    for b in range(int(dur / 0.5)):
        s = b * beat_s
        e = min(n, s + beat_s)
        tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
        # Soft punchy kick
        kf = 42.0 + 70.0 * np.exp(-tt * 28.0)
        kick = np.sin(2.0 * np.pi * np.cumsum(kf) / SR) * np.exp(-tt * 11.0) * 0.52
        # Offbeat synth bass
        bf = bass_notes[(b // 4) % len(bass_notes)]
        bass = np.tanh(1.5 * np.sin(2.0 * np.pi * bf * tt)) * np.exp(-tt * 4.5) * 0.28
        # Crisp hat on offbeat
        hat_s = s + beat_s // 2
        hat_e = min(n, hat_s + int(SR * 0.06))
        if hat_e > hat_s:
            ht = np.linspace(0, (hat_e - hat_s) / SR, hat_e - hat_s, endpoint=False)
            hat = _butter(rng.standard_normal(len(ht)), (4500, 9500), "band") * np.exp(-ht * 55.0) * 0.16
            l[hat_s:hat_e] += hat
            r[hat_s:hat_e] += hat
        l[s:e] += kick + bass
        r[s:e] += kick + bass
    l = _butter(l, 5200, "low")
    r = _butter(r, 5200, "low")
    return _normalize_stereo(l, r, 0.74)


def _synth_camera_shutter() -> np.ndarray:
    dur = 0.24
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(801)
    c1 = _butter(rng.standard_normal(len(t)), (1800, 7500), "band") * np.exp(-t * 140.0)
    dt = np.maximum(0.0, t - 0.042)
    m2 = (t >= 0.042).astype(np.float64)
    c2 = m2 * _butter(rng.standard_normal(len(t)), (1200, 5600), "band") * np.exp(-dt * 110.0) * 0.7
    body = np.sin(2.0 * np.pi * 240.0 * t) * np.exp(-t * 60.0) * 0.3
    sig = c1 + c2 + body
    return _normalize_stereo(sig, sig * 0.95, 0.86)


def _synth_paper_flip() -> np.ndarray:
    dur = 0.38
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(802)
    env = np.sin(np.pi * (t / dur)) ** 1.3 * (1.0 + 0.35 * np.sin(2.0 * np.pi * 24.0 * t))
    l = _butter(rng.standard_normal(len(t)), (1100, 6200), "band") * env
    r = _butter(rng.standard_normal(len(t)), (1250, 6600), "band") * env
    return _normalize_stereo(l, r, 0.8)


def _synth_tape_rewind() -> np.ndarray:
    dur = 0.65
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(803)
    f = 180.0 + 950.0 * (t / dur) ** 1.5
    whine = np.sin(2.0 * np.pi * np.cumsum(f) / SR) * 0.3
    flutter = _butter(rng.standard_normal(len(t)), (600, 4200), "band") * (0.6 + 0.4 * np.sin(2.0 * np.pi * 32.0 * t))
    env = np.sin(np.pi * (t / dur)) ** 0.7
    return _normalize_stereo((whine + flutter) * env, (whine + flutter * 0.92) * env, 0.78)


def _synth_glitch_zap() -> np.ndarray:
    dur = 0.28
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(804)
    gates = ((np.sin(2.0 * np.pi * 45.0 * t) > -0.15).astype(np.float64)) * np.exp(-t * 8.5)
    tone = np.tanh(3.0 * np.sin(2.0 * np.pi * (140.0 + 520.0 * (t % 0.04) / 0.04) * t)) * 0.45
    noise = _butter(rng.standard_normal(len(t)), (900, 8200), "band") * 0.7
    return _normalize_stereo((tone + noise) * gates, (tone - noise * 0.9) * gates, 0.85)


def _synth_chalk_write() -> np.ndarray:
    dur = 0.42
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    rng = np.random.default_rng(805)
    env = np.sin(np.pi * (t / dur)) ** 0.9 * (0.55 + 0.45 * np.sin(2.0 * np.pi * 18.0 * t))
    sig = _butter(rng.standard_normal(len(t)), (1900, 6800), "band") * env
    return _normalize_stereo(sig, sig * 0.92, 0.76)


def _synth_bell_soft() -> np.ndarray:
    dur = 1.3
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    env = np.minimum(1.0, t / 0.008) * np.exp(-t * 2.8)
    l = (np.sin(2.0 * np.pi * 523.25 * t) * 0.65 + np.sin(2.0 * np.pi * 1046.5 * t) * 0.25) * env
    r = (np.sin(2.0 * np.pi * 524.5 * t) * 0.65 + np.sin(2.0 * np.pi * 1044.0 * t) * 0.25) * env
    return _normalize_stereo(l, r, 0.78)


def _synth_cinematic_braam() -> np.ndarray:
    dur = 1.9
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    env = np.minimum(1.0, t / 0.14) * np.exp(-np.maximum(0.0, t - 0.55) * 1.9)
    l = np.tanh(2.4 * (np.sin(2.0 * np.pi * 55.0 * t) + 0.55 * np.sin(2.0 * np.pi * 110.4 * t) + 0.3 * np.sin(2.0 * np.pi * 165.0 * t))) * env
    r = np.tanh(2.4 * (np.sin(2.0 * np.pi * 55.0 * t) + 0.55 * np.sin(2.0 * np.pi * 109.6 * t) + 0.3 * np.sin(2.0 * np.pi * 165.6 * t))) * env
    l = _butter(l, 1600, "low")
    r = _butter(r, 1600, "low")
    return _normalize_stereo(l, r, 0.88)


def _synth_bgm_lofi_warm() -> np.ndarray:
    """16-second warm lo-fi Rhodes chord progression for nostalgia & study videos."""
    dur = 16.0
    n = int(SR * dur)
    chords = [
        [261.63, 329.63, 392.00, 493.88],  # Cmaj7
        [220.00, 261.63, 329.63, 392.00],  # Am7
        [174.61, 220.00, 261.63, 329.63],  # Fmaj7
        [196.00, 246.94, 293.66, 349.23],  # G7
    ]
    l = np.zeros(n, dtype=np.float64)
    r = np.zeros(n, dtype=np.float64)
    seg = n // 4
    for idx, freqs in enumerate(chords):
        s, e = idx * seg, (n if idx == 3 else (idx + 1) * seg)
        tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
        env = np.minimum(1.0, tt / 0.04) * np.exp(-tt * 0.45)
        for f in freqs:
            l[s:e] += (np.sin(2.0 * np.pi * (f + 0.2) * tt) + 0.2 * np.sin(4.0 * np.pi * f * tt)) * env * 0.16
            r[s:e] += (np.sin(2.0 * np.pi * (f - 0.2) * tt) + 0.2 * np.sin(4.0 * np.pi * f * tt)) * env * 0.16
    rng = np.random.default_rng(901)
    crackle = _butter(rng.standard_normal(n), (1800, 5200), "band") * 0.012
    l = _butter(l + crackle, 2200, "low")
    r = _butter(r + crackle, 2200, "low")
    return _normalize_stereo(l, r, 0.70)


def _synth_bgm_noir_tension() -> np.ndarray:
    """16-second suspenseful low-pulse bed for True Crime & Documentary Noir."""
    dur = 16.0
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    drone = (np.sin(2.0 * np.pi * 65.41 * t) * 0.45 + np.sin(2.0 * np.pi * 98.0 * t) * 0.25) * (0.75 + 0.25 * np.sin(2.0 * np.pi * 0.25 * t))
    l = drone.copy()
    r = drone.copy()
    step = int(SR * 0.5)
    for k in range(int(dur / 0.5)):
        s, e = k * step, min(n, (k + 1) * step)
        tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
        pulse = np.sin(2.0 * np.pi * 55.0 * tt) * np.exp(-tt * 9.0) * 0.32
        l[s:e] += pulse
        r[s:e] += pulse
    l = _butter(l, 1400, "low")
    r = _butter(r, 1400, "low")
    return _normalize_stereo(l, r, 0.72)


def _synth_bgm_cinematic_piano() -> np.ndarray:
    """16-second emotional storytelling felt-piano & pad bed."""
    dur = 16.0
    n = int(SR * dur)
    notes = [261.63, 329.63, 392.00, 523.25, 220.00, 261.63, 329.63, 440.00, 174.61, 220.00, 261.63, 349.23, 196.00, 246.94, 293.66, 392.00]
    l = np.zeros(n, dtype=np.float64)
    r = np.zeros(n, dtype=np.float64)
    step = n // len(notes)
    for idx, f in enumerate(notes):
        s, e = idx * step, min(n, idx * step + int(SR * 1.8))
        tt = np.linspace(0, (e - s) / SR, e - s, endpoint=False)
        env = np.minimum(1.0, tt / 0.015) * np.exp(-tt * 1.9)
        tone = (np.sin(2.0 * np.pi * f * tt) + 0.18 * np.sin(4.0 * np.pi * f * tt)) * env * 0.35
        pan = 0.42 if idx % 2 == 0 else 0.58
        l[s:e] += tone * pan
        r[s:e] += tone * (1.0 - pan)
    t = np.linspace(0, dur, n, endpoint=False)
    pad = np.sin(2.0 * np.pi * 130.81 * t) * 0.16
    l = _butter(l + pad, 2600, "low")
    r = _butter(r + pad, 2600, "low")
    return _normalize_stereo(l, r, 0.70)


SYNTH_MAP = {
    "sub_impact": _synth_sub_impact,
    "bass_drop": _synth_bass_drop,
    "deep_boom": _synth_deep_boom,
    "cinematic_braam": _synth_cinematic_braam,
    "whoosh_fast": lambda: _synth_whoosh(0.45, 301, 3400, True),
    "whoosh_soft": lambda: _synth_whoosh(0.68, 302, 2200, True),
    "swoosh_rise": _synth_swoosh_rise,
    "whip_pan": lambda: _synth_whoosh(0.26, 309, 4600, True),
    "tape_rewind": _synth_tape_rewind,
    "pop": _synth_pop,
    "click_ui": _synth_click_ui,
    "chime_ping": _synth_chime_ping,
    "type_tick": _synth_type_tick,
    "camera_shutter": _synth_camera_shutter,
    "paper_flip": _synth_paper_flip,
    "chalk_write": _synth_chalk_write,
    "glitch_zap": _synth_glitch_zap,
    "riser_tension": _synth_riser_tension,
    "shimmer_reveal": _synth_shimmer_reveal,
    "success_chord": _synth_success_chord,
    "bell_soft": _synth_bell_soft,
    "bgm_ambient_tech": _synth_bgm_ambient_tech,
    "bgm_editorial_pulse": _synth_bgm_editorial_pulse,
    "bgm_upbeat_kinetic": _synth_bgm_upbeat_kinetic,
    "bgm_lofi_warm": _synth_bgm_lofi_warm,
    "bgm_noir_tension": _synth_bgm_noir_tension,
    "bgm_cinematic_piano": _synth_bgm_cinematic_piano,
}


def ensure_sfx_library(out_dir: Path | None = None, force: bool = False) -> Dict[str, str]:
    target = out_dir or (Path(__file__).resolve().parent / "sfx_library")
    target.mkdir(parents=True, exist_ok=True)
    generated: Dict[str, str] = {}
    for name, fn in SYNTH_MAP.items():
        wav_path = target / f"{name}.wav"
        if force or not wav_path.exists() or wav_path.stat().st_size < 100:
            audio = fn()
            _write_wav(wav_path, audio)
        generated[name] = str(wav_path)
    return generated


def verify_sfx_library(out_dir: Path) -> Tuple[bool, List[Dict[str, object]]]:
    results = []
    all_ok = True
    for name in SYNTH_MAP:
        wav_path = out_dir / f"{name}.wav"
        if not wav_path.exists():
            all_ok = False
            results.append({"id": name, "ok": False, "error": "missing"})
            continue
        with wave.open(str(wav_path), "rb") as wf:
            sr = wf.getframerate()
            ch = wf.getnchannels()
            frames = wf.getnframes()
            ok = sr == SR and ch == 2 and frames > 0
            if not ok:
                all_ok = False
            results.append({
                "id": name,
                "ok": ok,
                "sampleRate": sr,
                "channels": ch,
                "durationSec": round(frames / sr, 3),
            })
    return all_ok, results


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="AGY Video Studio Procedural 4-Layer SFX Generator")
    parser.add_argument("--out-dir", type=str, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    out_dir = Path(args.out_dir) if args.out_dir else (Path(__file__).resolve().parent / "sfx_library")

    if args.list:
        print(json.dumps({"sfx": SFX_CATALOG, "bgm": BGM_CATALOG}, ensure_ascii=False))
        return 0

    ensure_sfx_library(out_dir, force=args.force)
    if args.check:
        ok, items = verify_sfx_library(out_dir)
        print(json.dumps({"ok": ok, "count": len(items), "items": items}, ensure_ascii=False))
        return 0 if ok else 1

    print(json.dumps({"ok": True, "outDir": str(out_dir), "count": len(SYNTH_MAP)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
