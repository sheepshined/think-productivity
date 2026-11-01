#!/usr/bin/env python3
"""图片批量处理 —— 压缩 / 缩放 / 转格式（依赖 Pillow）。

用法:
    python image_tools.py <目录> --compress 80          # 压缩到质量 80（默认覆盖前先备份到 _originals）
    python image_tools.py <目录> --max-side 1920        # 最长边缩到 1920px
    python image_tools.py <目录> --to webp              # 批量转成 webp
    python image_tools.py a.jpg b.png --compress 75     # 也可以指定具体文件

首次使用请先安装依赖:  pip install Pillow
"""
from __future__ import annotations
import argparse
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("✗ 缺少依赖 Pillow，请先执行:  pip install Pillow")
    sys.exit(1)

Image.MAX_IMAGE_PIXELS = 200_000_000  # 防解压炸弹

FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def process_one(path: Path, args, backup_dir: Path | None) -> tuple[Path, int, int]:
    """返回 (输出路径, 原大小, 新大小)"""
    target_fmt = args.to.lower() if args.to else path.suffix.lstrip(".").lower()
    out_path = path.with_suffix("." + target_fmt.split("_")[0]) if args.to else path

    with Image.open(path) as im:
        im.load()
        # 缩放
        if args.max_side and max(im.size) > args.max_side:
            ratio = args.max_side / max(im.size)
            new_size = (max(1, round(im.width * ratio)), max(1, round(im.height * ratio)))
            im = im.resize(new_size, Image.LANCZOS)
        # RGBA 转 JPEG 需要白底
        if out_path.suffix.lower() in (".jpg", ".jpeg", ".bmp") and im.mode in ("RGBA", "P", "LA"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg

        save_kwargs: dict = {"quality": args.compress, "optimize": True}
        if out_path.suffix.lower() == ".webp":
            save_kwargs["method"] = 6
        out_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(out_path, **save_kwargs)

    if backup_dir and args.to is None and out_path == path:
        backup_dir.mkdir(exist_ok=True)
        if not (backup_dir / path.name).exists():
            shutil.copy2(path, backup_dir / path.name)

    old, new = path.stat().st_size, out_path.stat().st_size
    return out_path, old, new


def main() -> int:
    ap = argparse.ArgumentParser(description="图片批量压缩 / 缩放 / 转格式")
    ap.add_argument("paths", nargs="+", help="目录或图片文件")
    ap.add_argument("--compress", type=int, default=85, metavar="1-95", help="JPEG/WEBP 质量（默认 85）")
    ap.add_argument("--max-side", type=int, default=0, metavar="PX", help="最长边缩到指定像素，0 表示不缩放")
    ap.add_argument("--to", choices=["webp", "jpg", "png"], help="转换为目标格式")
    ap.add_argument("--no-backup", action="store_true", help="不备份原图（原地覆盖时）")
    args = ap.parse_args()

    if not (1 <= args.compress <= 95):
        ap.error("--compress 取值 1-95")

    files: list[Path] = []
    for p in map(Path, args.paths):
        if p.is_dir():
            files += [f for f in sorted(p.iterdir()) if f.suffix.lower() in FORMATS]
        elif p.is_file():
            files.append(p)
        else:
            print(f"✗ 跳过不存在的路径: {p}")
    if not files:
        print("没有找到可处理的图片。")
        return 0

    backup_dir = None
    if not args.no_backup and not args.to:
        base = files[0].parent if files[0].is_file() else Path(args.paths[0])
        backup_dir = base / "_originals"

    done = 0
    for f in files:
        try:
            out_path, old, new = process_one(f, args, backup_dir)
            saved = f"{(1 - new / old) * 100:.0f}%" if old and new < old else f"{new / old * 100:.0f}%" if old else "?"
            arrow = "→ " + out_path.name if out_path != f else ""
            print(f"  {f.name:<36} {arrow:<20} {old // 1024}KB → {new // 1024}KB  ({saved})")
            done += 1
        except Exception as e:
            print(f"  ✗ {f.name}: {e}")

    if backup_dir and backup_dir.exists() and done:
        print(f"\n原图已备份到: {backup_dir}")
    print(f"\n✓ 处理完成 {done}/{len(files)} 张。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
