#!/usr/bin/env python3
"""AI 模拟面试系统 · 服务管理器

把 E:\\hiagent\\DEMO3\\TOtal 的 FastAPI 后端 + Vue 前端一键启动 / 停止 / 体检。
默认端口：后端 :8000、前端 :3000。若 8000 被其他程序占用（比如机器上的
deepdossier 等项目），后端自动改用 8001/8002，并通过 VITE_BACKEND_TARGET
让前端代理指向新端口，两边互不干扰。

用法:
    python interview.py start      # 启动前后端（已在跑的自动跳过，端口被占自动换）
    python interview.py stop       # 只停止本项目服务（按命令行识别，不误杀他人进程）
    python interview.py status     # 查看运行状态与端口归属
    python interview.py doctor     # 环境体检（venv / node_modules / .env / 向量库）
    python interview.py open       # 只打开浏览器

演示账号: admin / 123123
"""
from __future__ import annotations
import os
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

PROJECT = Path(r"E:\hiagent\DEMO3\TOtal")
BACKEND = PROJECT / "backend"
FRONTEND = PROJECT / "frontend"
FRONTEND_PORT = 3000
BACKEND_PORT_CANDIDATES = [8000, 8001, 8002]   # 8000 被占时依次尝试
BACKEND_LOG = BACKEND / "server_8000.log"
FRONTEND_LOG = FRONTEND / "vite_3000.log"
FRONTEND_URL = f"http://127.0.0.1:{FRONTEND_PORT}"

DETACHED = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP


def _run_text(cmd: list[str]) -> str:
    """Windows 命令输出可能是 GBK，做容错解码"""
    try:
        raw = subprocess.run(cmd, capture_output=True, timeout=20).stdout
        return raw.decode("utf-8", errors="replace") if raw else ""
    except Exception:
        return ""


def port_up(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.6)
        return s.connect_ex(("127.0.0.1", port)) == 0


def wait_port(port: int, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_up(port):
            return True
        time.sleep(1)
    return False


def pids_on(port: int) -> list[int]:
    pids = set()
    for line in _run_text(["netstat", "-ano", "-p", "TCP"]).splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0] == "TCP" and "LISTENING" in parts and parts[1].endswith(f":{port}"):
            pids.add(int(parts[-1]))
    return sorted(pids)


def cmdline_of(pid: int) -> str:
    """用 PowerShell CIM 取进程命令行（wmic 在新系统已移除）。
    WMI 故障时 PowerShell 会超时, 返回空串, 由 exe_path_of 降级兜底。"""
    ps = f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine"
    out = _run_text(["powershell", "-NoProfile", "-Command", ps])
    return out.strip()


def exe_path_of(pid: int) -> str:
    """不依赖 WMI 的进程镜像路径查询（WMI 故障时的降级方案）"""
    try:
        import ctypes
        import ctypes.wintypes as wt
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        k32 = ctypes.windll.kernel32
        h = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not h:
            return ""
        buf = ctypes.create_unicode_buffer(1024)
        size = wt.DWORD(1024)
        ok = k32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size))
        k32.CloseHandle(h)
        return buf.value if ok else ""
    except Exception:
        return ""


def name_of(pid: int) -> str:
    for line in _run_text(["tasklist", "/FI", f"PID eq {pid}"]).splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1] == str(pid):
            return parts[0]
    # WMI/tasklist 不可用: 从 exe 路径取文件名兜底
    exe = exe_path_of(pid)
    return exe.rsplit("\\", 1)[-1] if exe else "?"


def port_owner_desc(port: int) -> str:
    """端口占用者描述，如 deepdossier.exe(PID 38708) serve"""
    for pid in pids_on(port):
        name = name_of(pid)
        cmd = cmdline_of(pid) or exe_path_of(pid)
        short = cmd[:90] + ("…" if len(cmd) > 90 else "")
        return f"{name}(PID {pid}) {short}"
    return ""


def _venv_python_paths() -> set:
    """venv 相关解释器路径集合: 启动器 + pyvenv.cfg 里的基础解释器。
    进程 exe 报告的是基础解释器路径, 两者都要认。"""
    paths = {(BACKEND / ".venv" / "Scripts" / "python.exe").as_posix().lower()}
    try:
        cfg = (BACKEND / ".venv" / "pyvenv.cfg").read_text(encoding="utf-8")
        for line in cfg.splitlines():
            for key in ("home =", "executable ="):
                if line.strip().startswith(key):
                    p = line.split("=", 1)[1].strip()
                    if not p.lower().endswith("python.exe"):
                        p = p.rstrip("\\/") + "\\python.exe"
                    paths.add(p.replace("\\", "/").lower())
    except OSError:
        pass
    return paths


def is_our_backend(pid: int) -> bool:
    cmd = cmdline_of(pid)
    if cmd:
        return "uvicorn" in cmd and "server:app" in cmd
    # WMI 降级: 本项目后端跑在 venv 的解释器上（deepdossier 用 anaconda python, 路径可区分）
    exe = exe_path_of(pid).replace("\\", "/").lower()
    return bool(exe) and exe in _venv_python_paths()


def is_our_frontend(pid: int) -> bool:
    cmd = cmdline_of(pid)
    if cmd:
        return "vite" in cmd.lower() or ("npm" in cmd.lower() and "run" in cmd.lower())
    # WMI 降级: 3000 端口上的 node.exe 即本项目前端
    return exe_path_of(pid).lower().endswith("node.exe")


def start_backend(port: int) -> bool:
    py = BACKEND / ".venv" / "Scripts" / "python.exe"
    if not py.exists():
        print("  ✗ 缺少 backend/.venv，先看 START_GUIDE.md 完成首次安装")
        return False
    log = open(BACKEND_LOG, "ab")
    subprocess.Popen(
        [str(py), "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(BACKEND), stdout=log, stderr=log, creationflags=DETACHED,
    )
    print(f"  后端启动中 → :{port}（日志 server_8000.log）… 首次加载本地 BGE 模型可能要 1-2 分钟")
    ok = wait_port(port, 180)
    print(f"  {'✓ 后端就绪 http://127.0.0.1:' + str(port) if ok else '✗ 后端 180 秒内未就绪，去看日志'}")
    return ok


def start_frontend(backend_port: int) -> bool:
    if not (FRONTEND / "node_modules").exists():
        print("  ✗ 缺少 frontend/node_modules，先在 frontend 目录执行 npm install")
        return False
    env = dict(os.environ)
    env["VITE_BACKEND_TARGET"] = f"http://127.0.0.1:{backend_port}"
    log = open(FRONTEND_LOG, "ab")
    subprocess.Popen(
        ["cmd", "/c", "npm", "run", "dev", "--", "--host", "127.0.0.1"],
        cwd=str(FRONTEND), stdout=log, stderr=log, creationflags=DETACHED, env=env,
    )
    print(f"  前端启动中 → :{FRONTEND_PORT}（代理指向后端 :{backend_port}）…")
    ok = wait_port(FRONTEND_PORT, 60)
    print(f"  {'✓ 前端就绪 ' + FRONTEND_URL if ok else '✗ 前端 60 秒内未就绪，去看 vite_3000.log'}")
    return ok


def our_backend_port() -> int | None:
    """返回本项目后端正在使用的端口，没在跑返回 None"""
    for port in BACKEND_PORT_CANDIDATES:
        if port_up(port) and any(is_our_backend(p) for p in pids_on(port)):
            return port
    return None


def cmd_start(args) -> int:
    print("启动 AI 模拟面试系统")

    # ---- 后端：找可用端口 ----
    backend_port = our_backend_port()
    if backend_port:
        print(f"  后端已在运行  http://127.0.0.1:{backend_port}")
    else:
        backend_port = None
        for cand in BACKEND_PORT_CANDIDATES:
            if not port_up(cand):
                backend_port = cand
                break
            owner = port_owner_desc(cand)
            if any(is_our_backend(p) for p in pids_on(cand)):
                backend_port = cand
                break
            print(f"  ! 端口 {cand} 被其他程序占用：{owner}")
        if backend_port is None:
            print("  ✗ 8000-8002 全被占用，无法启动后端")
            return 1
        if not start_backend(backend_port):
            return 1

    # ---- 前端 ----
    fe_occupied = port_up(FRONTEND_PORT) and not any(is_our_frontend(p) for p in pids_on(FRONTEND_PORT))
    if fe_occupied:
        print(f"  ✗ 端口 {FRONTEND_PORT} 被其他程序占用：{port_owner_desc(FRONTEND_PORT)}")
        return 1
    if port_up(FRONTEND_PORT):
        # 已有 vite 在跑，但代理目标可能不对（比如后端换了端口）→ 重启它
        if backend_port != 8000:
            print("  后端不在默认 8000，重启前端以更新代理指向…")
            for pid in pids_on(FRONTEND_PORT):
                if is_our_frontend(pid):
                    subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], capture_output=True, timeout=15)
            time.sleep(1.5)
            if not start_frontend(backend_port):
                return 1
        else:
            print(f"  前端已在运行  {FRONTEND_URL}")
    else:
        if not start_frontend(backend_port):
            return 1

    webbrowser.open(FRONTEND_URL)
    tip = f"\n✓ 全部就绪，已打开 {FRONTEND_URL}（admin / 123123）"
    if backend_port != 8000:
        tip += f"\n  （后端使用非默认端口 :{backend_port}，前端代理已自动指向它，与占用 8000 的程序互不干扰）"
    print(tip)
    return 0


def cmd_stop(args) -> int:
    print("停止 AI 模拟面试系统")
    killed = 0
    for port, ours, name in [
        (FRONTEND_PORT, is_our_frontend, "前端"),
        *[ (p, is_our_backend, "后端") for p in BACKEND_PORT_CANDIDATES ],
    ]:
        for pid in pids_on(port):
            if not ours(pid):
                who = port_owner_desc(port)
                if who:
                    print(f"  跳过端口 {port}：不是本项目进程（{who}）")
                continue
            subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], capture_output=True, timeout=15)
            print(f"  ✓ 已停止 {name} {name_of(pid)}(PID {pid})")
            killed += 1
    if not killed:
        print("  没有本项目在运行的服务。")
    return 0


def cmd_status(args) -> int:
    print("AI 模拟面试系统状态")
    backend_port = our_backend_port()
    if backend_port:
        print(f"  ● 运行中 后端 FastAPI  http://127.0.0.1:{backend_port}/docs")
    else:
        occ = port_owner_desc(8000) or port_owner_desc(8001) or port_owner_desc(8002)
        if occ:
            print(f"  ○ 未启动 后端 FastAPI  （端口被其他程序占用：{occ}）")
        else:
            print("  ○ 未启动 后端 FastAPI")
    if port_up(FRONTEND_PORT) and any(is_our_frontend(p) for p in pids_on(FRONTEND_PORT)):
        print(f"  ● 运行中 前端 Vue      {FRONTEND_URL}")
    else:
        occ = port_owner_desc(FRONTEND_PORT)
        if occ:
            print(f"  ○ 未启动 前端 Vue      （端口被其他程序占用：{occ}）")
        else:
            print(f"  ○ 未启动 前端 Vue      {FRONTEND_URL}")

    if backend_port and port_up(FRONTEND_PORT) and any(is_our_frontend(p) for p in pids_on(FRONTEND_PORT)):
        print(f"\n可以开始面试了 → {FRONTEND_URL}")
    else:
        print("\n执行 python interview.py start 一键启动（端口冲突会自动规避）")
    return 0


def cmd_doctor(args) -> int:
    checks = [
        ("后端虚拟环境", (BACKEND / ".venv" / "Scripts" / "python.exe").exists()),
        ("前端依赖 node_modules", (FRONTEND / "node_modules").exists()),
        (".env 已配置", (BACKEND / ".env").exists()),
        ("向量库 chroma_db", (BACKEND / "chroma_db").exists()),
        ("题库 data", (BACKEND / "data").exists()),
    ]
    print("环境体检")
    bad = 0
    for name, ok in checks:
        print(f"  {'✓' if ok else '✗'} {name}")
        bad += (not ok)
    print("\n" + ("环境完整，可以启动。" if not bad else f"缺少 {bad} 项，见 TOtal/START_GUIDE.md。"))
    return 0


def cmd_open(args) -> int:
    webbrowser.open(FRONTEND_URL)
    print("已在浏览器打开 " + FRONTEND_URL)
    return 0


def main() -> int:
    cmds = {"start": cmd_start, "stop": cmd_stop, "status": cmd_status,
            "doctor": cmd_doctor, "open": cmd_open}
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    if action not in cmds:
        print(__doc__)
        return 1
    return cmds[action](sys.argv[2:])


if __name__ == "__main__":
    sys.exit(main())
