"""Original, licence-free audio for the showcase, synthesised here (no samples, no third-party music).

Writes public/audio/:
  music-60.wav, music-30.wav  soft instrumental bed (warm pads + gentle plucked arpeggio, 84 bpm)
  click.wav                    short, soft interface tick
  pop.wav                      soft rounded "card in" blip
  whoosh.wav                   very quiet airy transition swell
  chime.wav                    two-note confirmation chime
Run: python3 -I scripts/make-audio.py   (needs numpy)
"""
import os
import wave
import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def write(name, x):
    x = np.clip(x, -1, 1)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    data = (x * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(x, cutoff):
    # one-pole low-pass, simple and smooth
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def pad_note(freq, dur):
    t = np.arange(int(dur * SR)) / SR
    # a few slightly detuned soft partials; slow attack and release
    tone = sum(np.sin(2 * np.pi * freq * m * (1 + d) * t + p) * g
               for m, d, p, g in [(1, 0, 0, 1), (1, 0.0025, 1.3, 0.8), (2, -0.002, 0.4, 0.22), (3, 0.001, 2.1, 0.07)])
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.4)
    return tone * np.clip(env, 0, 1)


def pluck(freq, dur=1.6):
    t = np.arange(int(dur * SR)) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t) + 0.12 * np.sin(2 * np.pi * freq * 3 * t)
    env = np.exp(-t * 3.2) * np.minimum(1, t / 0.006)
    return tone * env


def music(seconds):
    bpm = 84
    beat = 60 / bpm
    bar = beat * 4
    # Cmaj9 – Am9 – Fmaj7 – G6sus, voiced low and soft
    chords = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 55, 57, 62]]
    arps = [[72, 76, 79, 76, 74, 76, 71, 74], [69, 72, 76, 72, 71, 72, 67, 71], [69, 72, 77, 72, 76, 72, 69, 72], [67, 71, 74, 71, 72, 74, 67, 71]]
    n = int(seconds * SR)
    mix = np.zeros((n, 2))
    bars = int(np.ceil(seconds / bar)) + 1
    for b in range(bars):
        start = int(b * bar * SR)
        ci = b % 4
        for k, m in enumerate(chords[ci]):
            s = pad_note(hz(m), bar + 1.2) * (0.05 if k else 0.07)
            pan = 0.5 + (k - 2) * 0.12
            end = min(n, start + len(s))
            if start < n:
                mix[start:end, 0] += s[: end - start] * (1 - pan)
                mix[start:end, 1] += s[: end - start] * pan
        if b >= 1:  # arpeggio enters after the first bar
            for k, m in enumerate(arps[ci]):
                st = start + int(k * beat / 2 * SR)
                s = pluck(hz(m)) * 0.05 * (0.85 if k % 2 else 1)
                pan = 0.35 if k % 2 else 0.65
                end = min(n, st + len(s))
                if st < n:
                    mix[st:end, 0] += s[: end - st] * (1 - pan)
                    mix[st:end, 1] += s[: end - st] * pan
    # soft low pulse on beats 1 and 3 (felt, not heard)
    for b in range(int(seconds / beat)):
        if b % 2 == 0 and b >= 4:
            st = int(b * beat * SR)
            t = np.arange(int(0.5 * SR)) / SR
            s = np.sin(2 * np.pi * 55 * t) * np.exp(-t * 7) * 0.08
            end = min(n, st + len(s))
            mix[st:end] += (s[: end - st])[:, None]
    # gentle room: a couple of quiet echoes
    for delay, g in [(0.23, 0.18), (0.41, 0.1)]:
        d = int(delay * SR)
        mix[d:, 0] += mix[:-d, 1] * g
        mix[d:, 1] += mix[:-d, 0] * g
    # fades
    t = np.arange(n) / SR
    fade = np.minimum(1, t / 1.5) * np.minimum(1, (seconds - t) / 2.5)
    mix *= np.clip(fade, 0, 1)[:, None]
    mix /= np.max(np.abs(mix)) + 1e-9
    return mix * 0.5


def click():
    t = np.arange(int(0.045 * SR)) / SR
    noise = rng.standard_normal(len(t))
    body = np.sin(2 * np.pi * 1900 * t) * 0.6 + lowpass(noise, 5000) * 0.6
    return body * np.exp(-t * 140) * 0.5


def pop():
    t = np.arange(int(0.16 * SR)) / SR
    f = 520 + 380 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * np.minimum(1, t / 0.004) * 0.45


def whoosh():
    t = np.arange(int(0.7 * SR)) / SR
    noise = lowpass(rng.standard_normal(len(t)), 1800)
    env = np.sin(np.pi * np.clip(t / 0.7, 0, 1)) ** 2
    return noise * env * 0.35


def chime():
    out = np.zeros(int(1.2 * SR))
    for k, m in enumerate([84, 88]):
        st = int(k * 0.09 * SR)
        t = np.arange(len(out) - st) / SR
        s = (np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(2 * np.pi * hz(m) * 2.01 * t)) * np.exp(-t * 4.5) * np.minimum(1, t / 0.004)
        out[st:] += s * 0.22
    return out


write("music-60.wav", music(60))
write("music-30.wav", music(30))
write("click.wav", click())
write("pop.wav", pop())
write("whoosh.wav", whoosh())
write("chime.wav", chime())
print("audio written to", os.path.abspath(OUT))
