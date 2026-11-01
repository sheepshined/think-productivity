#!/usr/bin/env python3
"""THINK 工具箱 —— 统一菜单入口。

    python toolbox.py          # 进入交互菜单
每个工具也都可以独立运行，如: python file_organizer.py D:/下载 --execute
"""
from __future__ import annotations
import subprocess
import sys
from pathlib import Path

TOOLS = [
    ("1", "文件整理器", "file_organizer.py", "把下载文件夹里散乱的文件按类型归档"),
    ("2", "磁盘空间分析", "folder_size.py", "看看磁盘空间都被谁吃掉了"),
    ("3", "批量重命名", "batch_rename.py", "照片加序号、加日期、查找替换"),
    ("4", "强密码生成器", "password_generator.py", "密码 / 口令短语，加密安全随机"),
    ("5", "图片批量处理", "image_tools.py", "压缩、缩放、转 webp（需 Pillow）"),
    ("6", "PDF 工具", "pdf_tools.py", "合并、拆分、提取页（需 pypdf）"),
]


def run(script: str) -> None:
    print()
    ret = subprocess.call([sys.executable, str(Path(__file__).parent / script)])
    if ret != 0:
        print(f"\n（{script} 退出码 {ret}）")
    print()


def main() -> int:
    print("=" * 46)
    print("  THINK 工具箱 · 本地小工具集合")
    print("=" * 46)
    for num, name, script, desc in TOOLS:
        print(f"  [{num}] {name:<8} — {desc}")
    print("  [q] 退出")
    print("-" * 46)

    choice = input("选择工具: ").strip().lower()
    for num, _name, script, _desc in TOOLS:
        if choice == num:
            args = input("参数（直接回车看该工具的帮助）: ").strip()
            script_path = str(Path(__file__).parent / script)
            cmd = [sys.executable, script_path] + ([] if not args else args.split())
            print()
            return subprocess.call(cmd)
    if choice != "q":
        print("没有这个选项。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
