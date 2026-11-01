#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
agent.py — 手机 GUI 智能体(豆包手机式)
大脑:任意 OpenAI 兼容接口的模型(GLM/Qwen/GPT/Ollama 本地模型均可)
眼睛:adb 截图(vision 模式,压缩为 JPEG)或 uiautomator 控件树(text 模式)
手:  手机上的 AutoX.js 无障碍执行器(E:\think\tools\agent\agent_executor.js)

用法:
  python agent.py --goal "打开天气查看北京今天的天气"
  python agent.py --goal "..." --mode text        # 用文本模型(如 DeepSeek),读控件树
  python agent.py --goal "..." --steps 20         # 增加最大步数
  python agent.py --dry-run                        # 只做感知,不调用模型不执行
  python agent.py --selftest                       # 只测电脑↔手机通道
"""
import argparse
import base64
import io
import json
import re
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path

ADB = r"E:\think\tools\platform-tools\adb.exe"
CMD_REMOTE = "/sdcard/.agent_cmd.json"
RES_REMOTE = "/sdcard/.agent_result.json"
HERE = Path(__file__).parent

SYSTEM_PROMPT = """你是一个手机 GUI 智能体(类似豆包手机),操控一台 Android 手机(分辨率 1080x2400)。你每一步会看到一张屏幕截图或一棵控件树,然后选择一个动作执行。

可用动作(每步只输出一个 JSON 对象,不要输出其他文字):
{"thought":"一句话思考","action":{"type":"tap","x":540,"y":1200}}
{"thought":"...","action":{"type":"longclick","x":540,"y":800}}
{"thought":"...","action":{"type":"swipe","x1":540,"y1":1800,"x2":540,"y2":700,"ms":500}}
{"thought":"...","action":{"type":"text","value":"要输入的文字"}}
{"thought":"...","action":{"type":"key","value":"back"}}
{"thought":"...","action":{"type":"key","value":"home"}}
{"thought":"...","action":{"type":"launch","app":"应用名"}}
{"thought":"...","action":{"type":"clip","value":"文字"}}
{"thought":"...","action":{"type":"delay","ms":1000}}
{"thought":"...","action":{"type":"finish","success":true,"message":"任务完成情况的总结"}}

规则:
1. text 只能输入到"已聚焦的输入框",输入前必须先用 tap 点击目标输入框;
2. 找不到应用时用 launch 启动;界面不对时用 key back/home 调整;
3. swipe 用于滚动列表:手指从下往上滑(x1=x2, y1>y2)是向下翻页;
4. 任务已完成、或确认无法完成时,输出 finish 并在 message 里说明结果;
5. 仔细看截图/控件树里的文字再决定坐标;控件树模式下直接用给出的 center 坐标;
6. 不要重复同一个无效动作,无效就换思路(比如改用搜索、改用 swipe 翻页)。"""


def adb(*args, timeout=30, binary=False):
    r = subprocess.run([ADB, *args], capture_output=True, timeout=timeout)
    if binary:
        return r.stdout
    return r.stdout.decode("utf-8", "replace").strip()


def screencap_jpeg(max_width=896, quality=80):
    """截图并压缩为 JPEG,返回 base64。"""
    from PIL import Image
    png = adb("exec-out", "screencap", "-p", binary=True, timeout=30)
    img = Image.open(io.BytesIO(png)).convert("RGB")
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()


def bounds_center(bounds):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not m:
        return -1, -1
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def dump_ui(max_lines=350):
    """uiautomator 控件树 → 压缩文本(只保留有信息量的节点+中心坐标)。"""
    adb("shell", "uiautomator", "dump", "/sdcard/window_dump.xml", timeout=40)
    xml = adb("shell", "cat", "/sdcard/window_dump.xml", timeout=20)
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return "(控件树解析失败)"
    lines = []

    def walk(node, depth):
        if len(lines) >= max_lines:
            return
        a = node.attrib
        text = a.get("text", "").strip()
        desc = a.get("content-desc", "").strip()
        rid = a.get("resource-id", "").strip().split("/")[-1]
        clickable = a.get("clickable") == "true"
        if text or desc or clickable or rid:
            cx, cy = bounds_center(a.get("bounds", ""))
            cls = a.get("class", "").split(".")[-1]
            parts = ["  " * depth + f"<{cls}"]
            if text:
                parts.append(f'text="{text}"')
            if desc:
                parts.append(f'desc="{desc}"')
            if rid:
                parts.append(f'id="{rid}"')
            if clickable:
                parts.append("clickable")
            parts.append(f"center=({cx},{cy})>")
            lines.append(" ".join(parts))
        for child in node:
            walk(child, depth + 1)

    walk(root, 0)
    return "\n".join(lines) or "(空控件树)"


def send(actions, wait=30):
    """把动作发给手机执行器并等待结果。"""
    cid = "cmd" + uuid.uuid4().hex[:12]
    tmp = HERE / f".cmd_{cid}.json"
    tmp.write_text(json.dumps({"id": cid, "actions": actions}, ensure_ascii=False), encoding="utf-8")
    adb("push", str(tmp), CMD_REMOTE, timeout=30)
    tmp.unlink(missing_ok=True)
    deadline = time.time() + wait
    while time.time() < deadline:
        raw = adb("shell", "cat", RES_REMOTE, timeout=15)
        try:
            data = json.loads(raw)
            if data.get("id") == cid:
                return data
        except Exception:
            pass
        time.sleep(0.4)
    return {"ok": False, "error": "执行器结果超时(脚本还在运行吗?)"}


def call_llm(cfg, messages):
    body = json.dumps({
        "model": cfg["model"],
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 900,
    }, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        cfg["base_url"].rstrip("/") + "/chat/completions",
        data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + cfg["api_key"]},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def parse_action(content):
    m = re.search(r"\{.*\}", content, re.S)
    if not m:
        raise ValueError("模型没有返回 JSON: " + content[:200])
    return json.loads(m.group(0))


def observe(cfg, mode):
    if mode == "vision":
        v = cfg.get("vision", {})
        return screencap_jpeg(v.get("max_width", 896), v.get("jpeg_quality", 80))
    return dump_ui()


def build_user_text(goal, history):
    hist = "\n".join(history[-10:]) if history else "(刚开始,还没有历史步骤)"
    return f"任务:{goal}\n\n历史步骤:\n{hist}\n\n请根据最新观察,输出下一步动作的 JSON。"


def main():
    ap = argparse.ArgumentParser(description="手机 GUI 智能体")
    ap.add_argument("--goal", help="自然语言任务")
    ap.add_argument("--steps", type=int, default=None, help="最大步数")
    ap.add_argument("--mode", choices=["vision", "text"], default=None)
    ap.add_argument("--dry-run", action="store_true", help="只做感知并打印,不调模型不执行")
    ap.add_argument("--selftest", action="store_true", help="测试电脑↔手机通道")
    args = ap.parse_args()

    if args.selftest:
        print("通道自检:", json.dumps(send([{"type": "ping"}]), ensure_ascii=False))
        return

    if not args.goal and not args.dry_run:
        sys.exit("需要 --goal(或 --selftest)")
    cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    mode = args.mode or cfg.get("mode", "vision")
    max_steps = args.steps or cfg.get("max_steps", 15)

    if args.dry_run:
        obs = observe(cfg, mode)
        if mode == "vision":
            print(f"[dry-run] vision 模式:base64 大小 {len(obs) // 1024} KB(可直接喂给多模态模型)")
        else:
            print(f"[dry-run] text 模式,控件树预览:\n{obs[:2000]}")
        return

    history = []
    print(f"目标:{args.goal}(模式 {mode},最多 {max_steps} 步)")
    for step in range(1, max_steps + 1):
        print(f"\n===== 第 {step} 步 =====")
        t0 = time.time()
        obs = observe(cfg, mode)
        print(f"感知完成({time.time() - t0:.1f}s)")

        if mode == "vision":
            content = [
                {"type": "text", "text": build_user_text(args.goal, history)},
                {"type": "image_url",
                 "image_url": {"url": "data:image/jpeg;base64," + obs}},
            ]
        else:
            content = build_user_text(args.goal, history) + "\n\n当前控件树:\n" + obs

        t0 = time.time()
        try:
            answer = call_llm(cfg, [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ])
        except Exception as e:
            print(f"模型调用失败:{e}")
            sys.exit(1)
        print(f"模型思考({time.time() - t0:.1f}s):{answer[:150]}")

        try:
            decision = parse_action(answer)
        except ValueError as e:
            history.append(f"step{step}: 解析失败 {e}")
            continue
        thought = decision.get("thought", "")
        action = decision.get("action", {})
        atype = action.get("type", "?")

        if atype == "finish":
            print(f"\n★ 任务结束(success={action.get('success')}):{action.get('message')}")
            return

        result = send([action])
        ok = result.get("ok")
        detail = "; ".join(result.get("out", [])) or result.get("error", "")
        line = f"step{step}: {thought} | 动作={json.dumps(action, ensure_ascii=False)} | {'OK' if ok else '失败'} {detail}"
        print(line)
        history.append(line)
        time.sleep(0.6)

    print("\n达到最大步数,停止。")


if __name__ == "__main__":
    main()
