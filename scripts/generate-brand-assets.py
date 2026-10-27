#!/usr/bin/env python3
"""
Deterministic, zero-dependency PNG generator for ASTERIAL brand icons and
Android mipmap / splash screen assets. Uses 4x supersampling for crisp edges.
"""

from __future__ import annotations
import math
import os
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

BG_VOID = (5, 5, 7, 255)          # #050507
BG_CARD = (14, 14, 19, 255)       # #0E0E13
WHITE = (255, 255, 255, 255)      # #FFFFFF
RING = (255, 255, 255, 92)        # subtle orbital ring


def write_png(path: Path, width: int, height: int, rgba_bytes: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        start = y * stride
        raw.extend(rgba_bytes[start : start + stride])

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), level=9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def point_in_polygon(px: float, py: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (
            px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-9) + xi
        ):
            inside = not inside
        j = i
    return inside


def star_polygon(cx: float, cy: float, outer_r: float, inner_r: float) -> list[tuple[float, float]]:
    # 4-point ASTERIAL star matching SVG:
    # M16 4.5 L18.4 13.6 L27.5 16 L18.4 18.4 L16 27.5 L13.6 18.4 L4.5 16 L13.6 13.6 Z
    diag = inner_r
    return [
        (cx, cy - outer_r),
        (cx + diag, cy - diag),
        (cx + outer_r, cy),
        (cx + diag, cy + diag),
        (cx, cy + outer_r),
        (cx - diag, cy + diag),
        (cx - outer_r, cy),
        (cx - diag, cy - diag),
    ]


def rounded_rect_contains(px: float, py: float, x0: float, y0: float, x1: float, y1: float, r: float) -> bool:
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def render_icon(
    size: int,
    *,
    transparent_bg: bool = False,
    round_clip: bool = False,
    emblem_scale: float = 0.68,
    with_tile: bool = True,
) -> bytes:
    ss = 3  # 3x3 supersampling (9 samples/pixel)
    cx = size / 2.0
    cy = size / 2.0
    outer_r = (size / 2.0) * emblem_scale * 0.72
    inner_r = outer_r * (2.4 / 11.5)
    ring_r = outer_r * (6.2 / 11.5)
    ring_half_w = max(size * 0.014, 0.55)
    poly = star_polygon(cx, cy, outer_r, inner_r)

    tile_margin = size * 0.08
    tile_r = size * 0.22

    buf = bytearray(size * size * 4)
    offsets = [(i + 0.5) / ss for i in range(ss)]

    for y in range(size):
        for x in range(size):
            r_acc = g_acc = b_acc = a_acc = 0.0
            for oy in offsets:
                py = y + oy
                for ox in offsets:
                    px = x + ox
                    if round_clip and (px - cx) ** 2 + (py - cy) ** 2 > (size * 0.48) ** 2:
                        continue

                    if transparent_bg:
                        br, bg, bb, ba = 0.0, 0.0, 0.0, 0.0
                    else:
                        if with_tile and not round_clip:
                            if not rounded_rect_contains(
                                px, py, tile_margin, tile_margin, size - tile_margin, size - tile_margin, tile_r
                            ):
                                br, bg, bb, ba = (float(c) for c in BG_VOID)
                            else:
                                br, bg, bb, ba = (float(c) for c in BG_CARD)
                        else:
                            br, bg, bb, ba = (float(c) for c in BG_VOID)

                    dist = math.hypot(px - cx, py - cy)
                    if point_in_polygon(px, py, poly):
                        br, bg, bb, ba = 255.0, 255.0, 255.0, 255.0
                    elif abs(dist - ring_r) <= ring_half_w:
                        alpha = 0.36
                        out_a = alpha + (ba / 255.0) * (1.0 - alpha)
                        if out_a > 0:
                            br = (255.0 * alpha + br * (ba / 255.0) * (1.0 - alpha)) / out_a
                            bg = (255.0 * alpha + bg * (ba / 255.0) * (1.0 - alpha)) / out_a
                            bb = (255.0 * alpha + bb * (ba / 255.0) * (1.0 - alpha)) / out_a
                            ba = out_a * 255.0

                    # Premultiply accumulate
                    pa = ba / 255.0
                    r_acc += br * pa
                    g_acc += bg * pa
                    b_acc += bb * pa
                    a_acc += pa

            samples = ss * ss
            avg_a = a_acc / samples
            idx = (y * size + x) * 4
            if avg_a <= 1e-5:
                buf[idx : idx + 4] = b"\x00\x00\x00\x00"
            else:
                buf[idx] = min(255, int(round((r_acc / samples) / avg_a)))
                buf[idx + 1] = min(255, int(round((g_acc / samples) / avg_a)))
                buf[idx + 2] = min(255, int(round((b_acc / samples) / avg_a)))
                buf[idx + 3] = min(255, int(round(avg_a * 255.0)))

    return bytes(buf)


def render_splash(width: int, height: int) -> bytes:
    # Fast dark #050507 canvas with centered crisp emblem
    emblem_size = max(96, int(min(width, height) * 0.22))
    if emblem_size % 2 == 1:
        emblem_size += 1
    emblem = render_icon(emblem_size, transparent_bg=False, round_clip=False, emblem_scale=0.66, with_tile=True)

    row_bg = bytes(BG_VOID) * width
    canvas = bytearray(row_bg * height)

    x_off = (width - emblem_size) // 2
    y_off = (height - emblem_size) // 2

    for ey in range(emblem_size):
        dst_start = ((y_off + ey) * width + x_off) * 4
        src_start = ey * emblem_size * 4
        canvas[dst_start : dst_start + emblem_size * 4] = emblem[
            src_start : src_start + emblem_size * 4
        ]

    return bytes(canvas)


def main() -> None:
    # 1. Web / PWA icons in public/
    write_png(ROOT / "public/icon-192.png", 192, 192, render_icon(192, with_tile=False, emblem_scale=0.72))
    write_png(ROOT / "public/icon-512.png", 512, 512, render_icon(512, with_tile=False, emblem_scale=0.72))
    write_png(ROOT / "public/icon-maskable-512.png", 512, 512, render_icon(512, with_tile=False, emblem_scale=0.56))
    write_png(ROOT / "public/apple-touch-icon.png", 180, 180, render_icon(180, with_tile=False, emblem_scale=0.70))

    # 2. Android launcher mipmaps
    res = ROOT / "android/app/src/main/res"
    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }
    for density, (legacy_px, fg_px) in densities.items():
        d_dir = res / f"mipmap-{density}"
        write_png(d_dir / "ic_launcher.png", legacy_px, legacy_px, render_icon(legacy_px, with_tile=True, emblem_scale=0.68))
        write_png(d_dir / "ic_launcher_round.png", legacy_px, legacy_px, render_icon(legacy_px, round_clip=True, with_tile=False, emblem_scale=0.68))
        write_png(d_dir / "ic_launcher_foreground.png", fg_px, fg_px, render_icon(fg_px, transparent_bg=True, emblem_scale=0.52))

    # 3. Android dark splash drawables
    write_png(res / "drawable/splash.png", 480, 480, render_splash(480, 480))
    splash_sizes = {
        "port-mdpi": (320, 480),
        "port-hdpi": (480, 800),
        "port-xhdpi": (720, 1280),
        "port-xxhdpi": (960, 1600),
        "port-xxxhdpi": (1280, 1920),
        "land-mdpi": (480, 320),
        "land-hdpi": (800, 480),
        "land-xhdpi": (1280, 720),
        "land-xxhdpi": (1600, 960),
        "land-xxxhdpi": (1920, 1280),
    }
    for folder, (w, h) in splash_sizes.items():
        write_png(res / f"drawable-{folder}/splash.png", w, h, render_splash(w, h))

    print("Generated all ASTERIAL web & Android brand assets.")


if __name__ == "__main__":
    main()
