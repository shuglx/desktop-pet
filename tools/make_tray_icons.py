#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一生成三个桌宠的 macOS 托盘图标（源剪影: generated-images/pet-silhouette.png）:

  src/logo-mac.png     16x16
  src/logo-mac@2x.png  32x32

样式: 实心圆角方框 + 居中人像剪影镂空（镂空处 alpha=0）。
macOS Template Image (Tray + setTemplateImage(true)) 只读取 alpha 通道:
  - 方框区域 alpha=255 → 系统按菜单栏深浅渲染成黑色/白色
  - 人像剪影区域 alpha=0 → 透出菜单栏背景, 形成"白色圆边方框+人像镂空"效果

注意: 本脚本只生成 logo-mac*.png, 不触碰 logo.png（其他场景使用的 logo）。

用法:
  python3 tools/make_tray_icons.py            # 全部三个项目
  python3 tools/make_tray_icons.py yueyue     # 指定项目
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'generated-images', 'pet-silhouette.png')
PROJECTS = ['deepseek-doll', 'yueyue', 'cyberpunk-lucy']

# 布局参数（相对画布边长的比例）
RADIUS_RATIO = 0.215      # 圆角半径, 与 logo.png 视觉一致
CONTENT_RATIO = 0.74      # 方框内人像高度占比
SS = 4                    # 超采样倍数（抗锯齿）


def make_silhouette(raw_path):
    """白底黑剪影图 -> 裁剪后的 RGBA 纯黑剪影。
    alpha 软阈值: 亮度 <=100 全不透明, >=200 全透明, 中间线性过渡（保留抗锯齿）。"""
    im = Image.open(raw_path)
    lo, hi = 100, 200
    lut = [255 if v <= lo else 0 if v >= hi else round(255 * (hi - v) / (hi - lo))
           for v in range(256)]
    alpha = im.convert('L').point(lut)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.putalpha(alpha)
    bbox = alpha.getbbox()
    return out.crop(bbox) if bbox else out


def mac_frame_icon(sil, size):
    """实心圆角方框 alpha - 人像剪影 alpha = 镂空模板图（4x 超采样后缩回）"""
    big = size * SS
    # 实心圆角方框
    frame = Image.new('L', (big, big), 0)
    ImageDraw.Draw(frame).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=int(big * RADIUS_RATIO), fill=255)
    # 人像剪影 alpha 居中放入
    portrait = sil.copy()
    portrait.thumbnail((int(big * CONTENT_RATIO),) * 2, Image.LANCZOS)
    mask = Image.new('L', (big, big), 0)
    mask.paste(portrait.split()[3],
               ((big - portrait.width) // 2, (big - portrait.height) // 2))
    # 镂空: 方框减去人像
    frame = ImageChops.subtract(frame, mask)
    frame = frame.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.putalpha(frame)
    return out


def write_mac_pair(sil, src_dir):
    for size in (16, 32):
        name = 'logo-mac.png' if size == 16 else 'logo-mac@2x.png'
        mac_frame_icon(sil, size).save(os.path.join(src_dir, name))
        print('  wrote %s (%dx%d)' % (name, size, size))


def main():
    names = sys.argv[1:] or PROJECTS
    sil = make_silhouette(RAW)
    for name in names:
        print('== %s' % name)
        write_mac_pair(sil, os.path.join(ROOT, name, 'src'))


if __name__ == '__main__':
    main()
