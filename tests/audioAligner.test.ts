import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Python Audio Aligner (whisper_aligner.py)', () => {
  it('strips vocal tags and maps ASR timestamps back onto exact Vietnamese tokens monotonically', () => {
    const pyScript = `
import json, sys
sys.path.insert(0, "engine/audio")
from whisper_aligner import strip_vocal_tags, map_asr_to_script_tokens

clean = strip_vocal_tags("Xin chào <whisper> thế giới <short pause> tuyệt vời!")
assert clean == "Xin chào thế giới tuyệt vời!", clean

tokens = clean.split()
asr = [("xin", 0.10, 0.28), ("chao", 0.30, 0.55), ("the", 0.60, 0.78), ("gioi", 0.80, 1.05), ("tuyet", 1.15, 1.38), ("voi", 1.40, 1.75)]
mapped = map_asr_to_script_tokens(
    tokens=tokens,
    asr_words=asr,
    speech_start_ms=100,
    speech_end_ms=1800,
    beat_start_frame=0,
    dur_frames=120,
    fps=60,
    keyword_set={"tuyệt", "vời"},
    token_speakers=["Minh", "Minh", "Minh", "Lan", "Lan", "Lan"],
)
assert len(mapped) == 6
assert mapped[0]["word"] == "Xin"
assert mapped[-1]["word"] == "vời!"
assert mapped[-1]["isKeyword"] is True
assert mapped[0]["speaker"] == "Minh"
assert mapped[3]["speaker"] == "Lan"
for i in range(len(mapped)):
    assert mapped[i]["endFrame"] > mapped[i]["startFrame"]
    if i > 0:
        assert mapped[i]["startFrame"] >= mapped[i - 1]["endFrame"]
print(json.dumps({"ok": True, "count": len(mapped)}))
`;
    const res = spawnSync('python', ['-c', pyScript], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout.trim());
    expect(out.ok).toBe(true);
    expect(out.count).toBe(6);
  });
});
