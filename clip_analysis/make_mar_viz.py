# -*- coding: utf-8 -*-
"""
Replikasi PERSIS grafik sel 2.6b notebook (sanity_check_video) pada data
clip asli yang disimpan DebugClipSaver di perangkat.

Interval segmen dihitung ULANG dengan find_speech_interval versi Kotlin
(satu-satunya sumber kebenaran pipeline) — bukan dari kolom segment meta.csv.
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os

ANALYSIS = r"D:\claudeCode\SilentVoice\clip_analysis"
CLIPS = ["clip_2", "clip_4", "clip_5", "clip_6", "clip_7"]
OUT = os.path.join(ANALYSIS, "charts")
os.makedirs(OUT, exist_ok=True)


def read_meta(clip_dir):
    mar = []
    with open(os.path.join(clip_dir, "meta.csv"), encoding="utf-8") as f:
        header = f.readline()
        for line in f:
            parts = line.strip().split(",")
            if len(parts) >= 2:
                mar.append(float(parts[1]))
    return mar


def smooth_mar(mar, w=3):
    """uniform_filter1d(mar, size=w, mode='nearest') — identik notebook sel 2.3."""
    n = len(mar)
    half = w // 2
    out = [0.0] * n
    for i in range(n):
        s = 0.0
        cnt = 0
        for j in range(i - half, i + half + 1):
            idx = max(0, min(n - 1, j))
            s += mar[idx]
            cnt += 1
        out[i] = s / cnt
    return out


def find_speech_interval(mar):
    """Port KOTLIN LipPrecompute.findSpeechInterval — identik, termasuk
    baseline = sorted[p20Idx] dan margin = max(2, bestLen // 10)."""
    smoothed = smooth_mar(mar)
    n = len(smoothed)
    srt = sorted(smoothed)
    p20 = srt[int((n - 1) * 0.20)]
    mean = sum(smoothed) / n
    var = sum((x - mean) ** 2 for x in smoothed) / n
    std = var ** 0.5 + 1e-6
    threshold = p20 + 0.5 * std

    active = [x > threshold for x in smoothed]
    labels = [0] * n
    seg_count = 0
    i = 0
    while i < n:
        if active[i]:
            seg_count += 1
            while i < n and active[i]:
                labels[i] = seg_count
                i += 1
        else:
            i += 1

    if seg_count == 0:
        return 0, n - 1, threshold, smoothed

    counts = {}
    for l in labels:
        if l:
            counts[l] = counts.get(l, 0) + 1
    best = max(counts, key=counts.get)
    idxs = [i for i, l in enumerate(labels) if l == best]
    margin = max(2, len(idxs) // 10)
    onset = max(0, idxs[0] - margin)
    offset = min(n - 1, idxs[-1] + margin)
    return onset, offset, threshold, smoothed


def plot_clip(name):
    mar = read_meta(os.path.join(ANALYSIS, name))
    n = len(mar)
    onset, offset, threshold, smoothed = find_speech_interval(mar)

    # 1. VISUALISASI GRAFIK MAR — persis sel 2.6b
    plt.figure(figsize=(10, 3))
    plt.plot(mar, label="MAR (Raw)", alpha=0.5, color='gray')
    plt.plot(smoothed, label="MAR (Smoothed)", color='blue', linewidth=2)
    plt.axhline(threshold, color="red", linestyle=":", label="Threshold Aktivitas")
    plt.axvspan(onset, offset, color="orange", alpha=0.3, label="Segmen Ucapan Terpilih")
    plt.title(f"{name}  (total={n} frame -> diambil {offset - onset + 1} frame)")
    plt.xlabel("Frame ke-")
    plt.ylabel("Mouth Aspect Ratio (MAR)")
    plt.legend(loc="upper right", fontsize=8)
    plt.tight_layout()
    path = os.path.join(OUT, f"mar_{name}.png")
    plt.savefig(path, dpi=110)
    plt.close()
    return n, onset, offset, threshold, path


summary = []
for name in CLIPS:
    n, onset, offset, thr, path = plot_clip(name)
    summary.append((name, n, onset, offset, offset - onset + 1, thr))
    print(f"{name}: n={n} segmen [{onset}..{offset}] -> {offset - onset + 1} frame, "f"threshold={thr:.4f} -> {path}")

print("\nRingkasan:")
for row in summary:
    print(f"  {row[0]}: total={row[1]}, segmen=[{row[2]}..{row[3]}], diambil={row[4]}")