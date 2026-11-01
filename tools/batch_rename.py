#!/usr/bin/env python3
"""批量重命名 —— 加序号 / 加日期 / 查找替换，默认预览。

用法:
    python batch_rename.py <目录> --number                 # 照片001.jpg、照片002.jpg...
    python batch_rename.py <目录> --number --start 100     # 从 100 开始编号
    python batch_rename.py <目录> --date                   # 加日期前缀 2026-09-13_原名
    python batch_rename.py <目录> --replace "IMG_" "旅行"   # 替换文件名里的字样
    以上命令都只是预览，确认无误后加 --execute 真正执行。
"""
from __future__ import annotations
import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path


def plan_renames(files: list[Path], args) -> list[tuple[Path, Path]]:
    plan = []
    today = datetime.now().strftime("%Y-%m-%d")
    for i, f in enumerate(files, start=args.start):
        if args.number:
            new_name = f"{args.prefix}{i:0{args.width}d}{f.suffix.lower() if args.lower_ext else f.suffix}"
        elif args.date:
            new_name = f"{today}_{f.name}"
        else:  # replace
            new_name = f.name.replace(args.replace[0], args.replace[1])
        if new_name != f.name:
            plan.append((f, f.parent / new_name))
    return plan


def main() -> int:
    ap = argparse.ArgumentParser(description="批量重命名（默认只预览）")
    ap.add_argument("directory", help="目标目录")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--number", action="store_true", help="按序号重命名")
    mode.add_argument("--date", action="store_true", help="加日期前缀")
    mode.add_argument("--replace", nargs=2, metavar=("旧", "新"), help="替换文件名中的字样")
    ap.add_argument("--prefix", default="", help="序号模式的前缀，如 --prefix 照片")
    ap.add_argument("--start", type=int, default=1, help="起始编号（默认 1）")
    ap.add_argument("--width", type=int, default=3, help="编号位数（默认 3 位，001）")
    ap.add_argument("--lower-ext", action="store_true", help="序号模式下顺带把扩展名转小写")
    ap.add_argument("--execute", action="store_true", help="真正执行（默认只预览）")
    args = ap.parse_args()

    root = Path(args.directory).expanduser().resolve()
    if not root.is_dir():
        print(f"✗ 目录不存在: {root}")
        return 1

    files = sorted([p for p in root.iterdir() if p.is_file() and not p.name.startswith(".")])
    if not files:
        print("目录里没有文件。")
        return 0

    plan = plan_renames(files, args)
    if not plan:
        print("没有需要改动的文件名。")
        return 0

    # 防碰撞：目标名不能与未被重命名的现有文件冲突
    remaining = {f.name for f, _ in plan} ^ {f.name for f in files}
    for src, dst in plan:
        if dst.name in remaining:
            print(f"✗ 目标名冲突: {dst.name}，请换一种方式（如调整 --start / --prefix）")
            return 1

    width = max(len(src.name) for src, _ in plan)
    for src, dst in plan:
        mark = "" if args.execute else "（预览）"
        print(f"  {src.name:<{width}}  →  {dst.name}{mark}")

    if not args.execute:
        print(f"\n共 {len(plan)} 个文件待重命名。加 --execute 执行。")
        return 0

    for src, dst in plan:
        shutil.move(str(src), str(dst))
    print(f"\n✓ 已重命名 {len(plan)} 个文件。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
