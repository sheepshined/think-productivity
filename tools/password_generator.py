#!/usr/bin/env python3
"""强密码生成器 —— 使用加密安全的 secrets 模块。

用法:
    python password_generator.py                    # 1 个 16 位密码
    python password_generator.py -l 24 -n 5         # 5 个 24 位密码
    python password_generator.py --no-symbols       # 不用特殊符号（适合某些网站）
    python password_generator.py --passphrase -w 4  # 4 个单词组成的口令短语，好记好读
"""
from __future__ import annotations
import argparse
import secrets
import string
import sys

# 约 200 个常见英文单词，用于口令短语模式
WORDS = """apple river light cloud stone bird music paper summer winter
forest garden silver golden harbor meadow thunder breeze candle dragon eagle
falcon guitar island jungle kernel lantern marble noodle orchard penguin
quartz rocket shadow tiger velvet window yellow zebra anchor bridge castle
desert engine flower glacier hammer ice jasmine kettle lemon mountain
needle ocean pepper planet quilt rabbit sandwich turtle umbrella violin
whisper yoga zen beacon compass dawn ember frost grove hollow ivory jet
knife luna mirror north oasis pearl quest ripple summit temple unity
voyage willow xenon yield atlas bloom cedar dream elk flint glide honey
ignite jewel karma lumen mint noble orbit prism quill ridge solstice
tide unicorn valky wisp apex birch coral drift ember flint grove horizon
""".split()


def gen_password(length: int, use_symbols: bool) -> str:
    pools = [string.ascii_lowercase, string.ascii_uppercase, string.digits]
    if use_symbols:
        pools.append("!@#$%^&*-_=+?")
    # 保证每类至少一个
    chars = [secrets.choice(p) for p in pools]
    all_chars = "".join(pools)
    chars += [secrets.choice(all_chars) for _ in range(max(0, length - len(chars)))]
    # 安全洗牌
    for i in range(len(chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        chars[i], chars[j] = chars[j], chars[i]
    return "".join(chars)


def gen_passphrase(words: int, sep: str) -> str:
    return sep.join(secrets.choice(WORDS) for _ in range(words)) + sep + secrets.choice(string.digits * 100)


def main() -> int:
    ap = argparse.ArgumentParser(description="生成强密码 / 口令短语")
    ap.add_argument("-l", "--length", type=int, default=16, help="密码长度（默认 16，至少 8）")
    ap.add_argument("-n", "--count", type=int, default=1, help="生成数量（默认 1）")
    ap.add_argument("--no-symbols", action="store_true", help="不含特殊符号")
    ap.add_argument("--passphrase", action="store_true", help="口令短语模式（单词组合，好记）")
    ap.add_argument("-w", "--words", type=int, default=4, help="短语单词数（默认 4）")
    args = ap.parse_args()

    if not args.passphrase and args.length < 8:
        ap.error("密码长度至少 8 位")

    for _ in range(args.count):
        if args.passphrase:
            print(gen_passphrase(args.words, "-"))
        else:
            print(gen_password(args.length, not args.no_symbols))
    return 0


if __name__ == "__main__":
    sys.exit(main())
