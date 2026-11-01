#!/usr/bin/env python3
"""面试系统测试启动器（WMI 故障绕过版）

背景: 本机 WMI 服务目前处于"挂起"故障态 (sc query 显示 RUNNING 但所有
WMI/Win32 查询永久阻塞)。torch 在导入时会调用 platform.machine() → 走 WMI
查询 → 整个 pytest 进程卡死。这不是代码问题, 重启电脑或重启 WMI 服务后即恢复。

本脚本在导入任何重模块之前把 platform.machine 固定为 AMD64, 让测试可以
正常跑起来; 不修改项目里任何文件。

用法:
    python E:\\think\\tools\\run_tests.py            # 全量测试
    python E:\\think\\tools\\run_tests.py -k auth    # 透传给 pytest 的任意参数
"""
import platform
import sys
from pathlib import Path

BACKEND = Path(r"E:\hiagent\DEMO3\TOtal\backend")

# --- WMI 绕过: 必须在 torch/pytest 导入前生效 ---
# torch 初始化会调 platform.machine() / platform.system(), 二者都经
# uname() → win32_ver() → _wmi_query() (Python 3.13 新增 WMI 查询路径),
# 在 WMI 故障机上永久阻塞。win32_ver 被 patch 后整条链都不再查 WMI。
platform.win32_ver = lambda *a, **k: ("10", "10.0.26100", "", "Multiprocessor Free")
platform.win32_edition = lambda: "Professional"
platform.machine = lambda: "AMD64"
platform.processor = lambda: "AMD64"
platform.system = lambda: "Windows"

if __name__ == "__main__":
    import pytest

    args = sys.argv[1:] or ["-q"]
    # 默认用无锁 basetemp (项目 pytest.ini 指定的 .pytest_tmp 目录 ACL 已损坏)
    if not any(a.startswith("--basetemp") for a in args):
        args.append("--basetemp=.pytest_tmp_run")
    sys.exit(pytest.main(args))
