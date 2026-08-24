"""把 processed-videos/ 下的透明 .mov（HEVC + alpha, 1280x720）批量转成
640x360 透明 VP9 webm，输出到 src/pet/，供 yueyue 桌宠运行时播放。

参考 dsh-pet-main/scripts/encode_thumbs.py：
- 解码：HEVC alpha 辅助层由 ffmpeg 9 自动解码为 rgba，无需强制解码器
- scale 默认丢 alpha，需 format=yuva420p 强制保留
- 验证输出 alpha 时必须用 libvpx 解码器（-c:v libvpx-vp9），ffmpeg
  默认解码路径不合并 VP9 alpha，会误报 rgb24；Electron/Chromium 原生支持
- VP9 CRF 恒定质量模式 + row-mt 并行
- 断点续跑：输出已存在且有效则跳过
"""

from __future__ import annotations

import subprocess
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "processed-videos"
OUT = ROOT / "src" / "pet"

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"

PARALLEL = 4
TARGET_W = 640
TARGET_H = 360
CRF = 30      # VP9 质量（0-63，越小越清晰越大）
FPS = 30      # 与源一致，保持动作节奏


def convert_video(src: Path, dst: Path) -> None:
    cmd = [
        FFMPEG,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-vf",
        f"scale={TARGET_W}:{TARGET_H},format=yuva420p",  # 强制保留 alpha
        "-c:v",
        "libvpx-vp9",
        "-crf",
        str(CRF),
        "-b:v",
        "0",       # 恒定质量模式（CRF）
        "-row-mt",
        "1",
        "-r",
        str(FPS),
        "-an",     # 丢弃音轨
        str(dst),
    ]
    result = subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL,
                            stderr=subprocess.PIPE, text=True,
                            encoding="utf-8", errors="replace")
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())


def _is_valid(dst: Path, src: Path, min_size: int = 20_000) -> bool:
    """断点续跑完整性检查：存在、够大、不比源旧、且能被 ffprobe 读到视频流。"""
    if not dst.exists() or dst.stat().st_size <= min_size:
        return False
    if dst.stat().st_mtime < src.stat().st_mtime:
        return False
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "stream=codec_name",
                        "-of", "csv=p=0", str(dst)], capture_output=True)
    return bool(r.stdout.strip())


def _process_one(video: Path) -> tuple[str, int, int, bool]:
    src_size = video.stat().st_size
    dst = OUT / (video.stem + ".webm")
    if _is_valid(dst, video):
        return video.name, src_size, 0, True
    convert_video(video, dst)
    return video.name, src_size, dst.stat().st_size, False


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    videos = sorted(SRC.glob("*.mov"))
    if not videos:
        print(f"No .mov files found in {SRC}")
        return 1

    src_total = 0
    out_total = 0
    total = len(videos)
    failed: list[str] = []
    with ProcessPoolExecutor(max_workers=PARALLEL) as ex:
        for index, (name, src_size, out_size, skipped) in enumerate(
                ex.map(_process_one, videos), start=1):
            src_total += src_size
            out_total += out_size
            if skipped:
                print(f"[{index}/{total}] SKIP {name} (already encoded)", flush=True)
            else:
                print(f"[{index}/{total}] {name}  {src_size / 1e6:.1f}MB -> {out_size / 1e6:.1f}MB", flush=True)

    print(f"\n=== summary ===")
    print(f"masters: {total}")
    print(f"source total: {src_total / 1e6:.1f}MB")
    print(f"webm total: {out_total / 1e6:.1f}MB")
    if failed:
        print(f"FAILED: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
