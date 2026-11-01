#!/usr/bin/env python3
"""文件整理器 —— 按类型把散乱的文件归入子文件夹。

用法:
    python file_organizer.py <目录>            # 预览（不移动任何文件）
    python file_organizer.py <目录> --execute  # 真正执行整理
    python file_organizer.py <目录> --execute --by-date  # 按日期(年-月)分类
仅处理文件，不递归子目录；重名文件自动追加序号。
"""
from __future__ import annotations
import argparse
import shutil
import sys
from pathlib import Path

RULES = {
    "图片": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".heic", ".tif", ".tiff", ".raw"},
    "文档": {".doc", ".docx", ".pdf", ".txt", ".md", ".xlsx", ".xls", ".csv", ".ppt", ".pptx", ".odt", ".rtf", ".epub"},
    "音视频": {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm"},
    "压缩包": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".iso"},
    "代码": {".py", ".js", ".ts", ".html", ".css", ".java", ".c", ".cpp", ".h", ".go", ".rs", ".sh", ".bat", ".ps1", ".json", ".xml", ".yml", ".yaml", ".sql"},
    "程序安装包": {".exe", ".msi", ".apk", ".dmg", ".pkg", ".appx"},
    "字体": {".ttf", ".otf", ".woff", ".woff2"},
}


def classify(path: Path, by_date: bool) -> str:
    if by_date:
        mtime = path.stat().st_mtime
        import datetime
        return datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m")
    ext = path.suffix.lower()
    for folder, exts in RULES.items():
        if ext in exts:
            return folder
    return "其他"


def unique_target(folder: Path, name: str) -> Path:
    """重名文件追加序号: report.pdf -> report(1).pdf"""
    target = folder / name
    stem, ext = target.stem, target.suffix
    n = 1
    while target.exists():
        target = folder / f"{stem}({n}){ext}"
        n += 1
    return target


def main() -> int:
    ap = argparse.ArgumentParser(description="按类型整理文件夹里的散乱文件")
    ap.add_argument("directory", help="要整理的目录")
    ap.add_argument("--execute", action="store_true", help="真正执行（默认只预览）")
    ap.add_argument("--by-date", action="store_true", help="改按「年-月」分类（适合照片）")
    args = ap.parse_args()

    root = Path(args.directory).expanduser().resolve()
    if not root.is_dir():
        print(f"✗ 目录不存在: {root}")
        return 1

    moves: list[tuple[Path, Path]] = []
    for item in sorted(root.iterdir()):
        if item.is_dir() or item.name.startswith("."):
            continue
        dest_dir = root / classify(item, args.by_date)
        moves.append((item, unique_target(dest_dir, item.name)))

    if not moves:
        print("目录很干净，没有需要整理的文件。")
        return 0

    width = max(len(str(src.name)) for src, _ in moves)
    for src, dst in moves:
        mark = "→" if args.execute else "→(预览)"
        print(f"  {src.name:<{width}}  {mark}  {dst.parent.name}/{dst.name}")

    if not args.execute:
        print(f"\n共 {len(moves)} 个文件待移动。以上只是预览，加 --execute 才会真正移动。")
        return 0

    for src, dst in moves:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
    print(f"\n✓ 已整理 {len(moves)} 个文件。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
