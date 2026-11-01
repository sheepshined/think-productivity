#!/usr/bin/env python3
"""磁盘空间分析 —— 看看空间都被谁吃掉了。

用法:
    python folder_size.py <目录>                # 统计各子目录大小并排序
    python folder_size.py <目录> --depth 2      # 深入两层
    python folder_size.py <目录> --top 20       # 列出最大的 20 个文件
"""
from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path


def human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024
    return f"{n:.1f} PB"


def dir_size(path: Path) -> int:
    total = 0
    try:
        for entry in os.scandir(path):
            try:
                if entry.is_dir(follow_symlinks=False):
                    total += dir_size(Path(entry.path))
                elif entry.is_file(follow_symlinks=False):
                    total += entry.stat().st_size
            except (PermissionError, OSError):
                pass
    except (PermissionError, OSError):
        pass
    return total


def print_tree(path: Path, depth: int, max_depth: int, sizes: dict) -> None:
    if depth > max_depth:
        return
    subs = []
    try:
        for entry in os.scandir(path):
            if entry.is_dir(follow_symlinks=False):
                subs.append(Path(entry.path))
    except (PermissionError, OSError):
        return
    subs.sort(key=lambda p: sizes.get(p, dir_size(p)), reverse=True)
    for sub in subs:
        size = sizes.get(sub, dir_size(sub))
        sizes[sub] = size
        print(f"{'    ' * depth}├─ {sub.name:<40} {human(size):>12}")
        print_tree(sub, depth + 1, max_depth, sizes)


def main() -> int:
    ap = argparse.ArgumentParser(description="统计目录占用空间")
    ap.add_argument("directory", nargs="?", default=".", help="目标目录（默认当前目录）")
    ap.add_argument("--depth", type=int, default=1, help="展开层数（默认 1）")
    ap.add_argument("--top", type=int, default=0, help="额外列出最大的 N 个文件")
    args = ap.parse_args()

    root = Path(args.directory).expanduser().resolve()
    if not root.is_dir():
        print(f"✗ 目录不存在: {root}")
        return 1

    print(f"统计中（大目录可能需要一点时间）: {root}\n")
    total = dir_size(root)
    print(f"总占用: {human(total)}\n")
    print_tree(root, 0, args.depth, {})

    if args.top > 0:
        files: list[tuple[int, str]] = []
        for dirpath, _dirnames, filenames in os.walk(root):
            for f in filenames:
                fp = Path(dirpath) / f
                try:
                    files.append((fp.stat().st_size, str(fp)))
                except OSError:
                    pass
        files.sort(reverse=True)
        print(f"\n最大的 {args.top} 个文件:")
        for size, fp in files[: args.top]:
            print(f"  {human(size):>12}  {fp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
