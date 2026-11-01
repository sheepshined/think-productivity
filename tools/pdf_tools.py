#!/usr/bin/env python3
"""PDF 工具 —— 合并 / 拆分 / 提取页码范围（依赖 pypdf）。

用法:
    python pdf_tools.py merge a.pdf b.pdf c.pdf -o 合并.pdf   # 按顺序合并
    python pdf_tools.py split 全书.pdf                        # 拆成单页 PDF
    python pdf_tools.py extract 全书.pdf --pages 1-3,7 -o 精选.pdf

首次使用请先安装依赖:  pip install pypdf
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("✗ 缺少依赖 pypdf，请先执行:  pip install pypdf")
    sys.exit(1)


def parse_pages(spec: str, total: int) -> list[int]:
    """把 '1-3,7,10-' 解析成 0-based 页码列表"""
    pages: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_s, end_s = part.split("-", 1)
            start = int(start_s) - 1 if start_s else 0
            end = int(end_s) if end_s else total
        else:
            start = end = int(part)
        pages.extend(p for p in range(start, end) if 0 <= p < total)
    return pages


def cmd_merge(args) -> int:
    out = Path(args.output)
    writer = PdfWriter()
    total_pages = 0
    for f in args.files:
        reader = PdfReader(f)
        writer.append(reader)
        total_pages += len(reader.pages)
        print(f"  + {f} ({len(reader.pages)} 页)")
    writer.write(out)
    print(f"\n✓ 已合并 {len(args.files)} 个文件、共 {total_pages} 页 → {out}")
    return 0


def cmd_split(args) -> int:
    src = Path(args.pdf)
    reader = PdfReader(src)
    stem = src.stem
    out_dir = Path(args.output_dir) if args.output_dir else src.parent / (stem + "_分页")
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, page in enumerate(reader.pages, start=1):
        writer = PdfWriter()
        writer.add_page(page)
        writer.write(out_dir / f"{stem}_{i:03d}.pdf")
    print(f"✓ 已拆分 {len(reader.pages)} 页 → {out_dir}")
    return 0


def cmd_extract(args) -> int:
    src = Path(args.pdf)
    reader = PdfReader(src)
    pages = parse_pages(args.pages, len(reader.pages))
    if not pages:
        print("✗ 页码范围无效")
        return 1
    writer = PdfWriter()
    for p in pages:
        writer.add_page(reader.pages[p])
    out = Path(args.output)
    writer.write(out)
    shown = ",".join(str(p + 1) for p in pages)
    print(f"✓ 已提取第 {shown} 页（共 {len(pages)} 页）→ {out}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="PDF 合并 / 拆分 / 提取")
    sub = ap.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("merge", help="合并多个 PDF")
    m.add_argument("files", nargs="+")
    m.add_argument("-o", "--output", default="合并结果.pdf")
    m.set_defaults(func=cmd_merge)

    s = sub.add_parser("split", help="拆分为单页 PDF")
    s.add_argument("pdf")
    s.add_argument("--output-dir", default=None)
    s.set_defaults(func=cmd_split)

    e = sub.add_parser("extract", help="提取指定页")
    e.add_argument("pdf")
    e.add_argument("--pages", required=True, help='如 "1-3,7,10-"')
    e.add_argument("-o", "--output", required=True)
    e.set_defaults(func=cmd_extract)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
