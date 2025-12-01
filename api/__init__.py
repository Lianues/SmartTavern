"""
api package bootstrap

目的:
- 保证当导入 api.* 子包时，自动将仓库根目录加入 sys.path，确保 `import core` 等顶层包始终可用
- 这样各注册脚本/实现脚本无需在文件内重复写 try/except + sys.path 注入逻辑

说明:
- 本文件会在首次导入任意 api.* 模块时执行
- 若当前运行环境已正确将仓库根加入 sys.path，此处逻辑不会重复插入
"""

import os
import sys

_API_DIR = os.path.dirname(__file__)
_REPO_ROOT = os.path.abspath(os.path.join(_API_DIR, ".."))

if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)