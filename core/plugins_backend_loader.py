"""
插件后端 API 选择性注册加载器

目标
- 支持按插件目录下的 manifest.json 精确控制“注册哪些后端 API（Python）”
- 两种声明方式：
  1) 精确到“入口文件”（.py），直接导入该模块
  2) 精确到“入口目录”，自动扫描目录中的同名实现文件（如 foo/foo.py）

要求与约束
- 仅允许导入位于仓库 api/* 包下的模块（api.modules / api.workflow / api.plugins），确保命名空间推断正确：
  - [python.function(FunctionRegistry._derive_namespace)](core/api_registry.py:39) 仅识别 api.modules / api.workflow / api.plugins
- manifest.json 文件位于：backend_projects/<ProjectName>/plugins/<plugin-id>/manifest.json
- 后端入口字段优先使用：backend_entries（string[]），也兼容：backend_entry（string）、backend（string|string[]）、backend_api_entries（string[]）

使用
- 在启动器中调用：PluginsBackendLoader.load(manifest_only=True, project="SmartTavern")
- 当 manifest_only=True 时，仅按 manifest.json 中的 backend_entries 加载；未声明则跳过该插件
- 当 manifest_only=False 时，若插件未声明 backend_entries，可回退为“自动扫描 api/plugins/<project>/<plugin-id> 目录中的实现文件”

声明示例
- 文件级：
  { "backend_entries": ["api/plugins/smarttavern/example_backend/example_backend.py"] }
- 目录级：
  { "backend_entries": ["api/plugins/smarttavern/example_backend"] }
- 混合：
  { "backend_entries": ["api/plugins/smarttavern/foo", "api/plugins/smarttavern/bar/bar.py"] }

实现说明
- 对“目录级”声明：自动在目录中寻找“与目录同名的实现文件”，例如：
  - api/plugins/smarttavern/foo/ 期望存在 foo.py，则导入 api.plugins.smarttavern.foo.foo
- 对“文件级”声明：将文件路径转换为模块导入字符串，并直接 import
"""

import json
import importlib
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple


@dataclass
class LoaderResult:
    imported_modules: List[str]
    skipped_entries: List[Tuple[str, str]]  # (entry, reason)
    manifests_read: int


class PluginsBackendLoader:
    def __init__(self, repo_root: Optional[Path] = None):
        # core/ -> repo root
        here = Path(__file__).resolve()
        core_dir = here.parent
        self.repo_root = repo_root or core_dir.parent

    def _plugins_root(self, project: str) -> Path:
        return self.repo_root / "backend_projects" / project / "plugins"

    def _is_under(self, path: Path, base: Path) -> bool:
        try:
            _ = path.resolve().relative_to(base.resolve())
            return True
        except Exception:
            return False

    def _read_manifest(self, manifest_path: Path) -> Optional[dict]:
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def _extract_backend_entries(self, manifest: dict) -> List[str]:
        """
        支持多种字段名，统一返回 string 列表
        优先：backend_entries
        兼容：backend_entry, backend, backend_api_entries
        """
        if not manifest or not isinstance(manifest, dict):
            return []
        candidates = []
        if "backend_entries" in manifest:
            be = manifest.get("backend_entries")
            if isinstance(be, list):
                candidates.extend([str(x) for x in be])
            elif isinstance(be, str):
                candidates.append(be)
        elif "backend_entry" in manifest:
            be = manifest.get("backend_entry")
            if isinstance(be, list):
                candidates.extend([str(x) for x in be])
            elif isinstance(be, str):
                candidates.append(be)
        elif "backend" in manifest:
            be = manifest.get("backend")
            if isinstance(be, list):
                candidates.extend([str(x) for x in be])
            elif isinstance(be, str):
                candidates.append(be)
        elif "backend_api_entries" in manifest:
            be = manifest.get("backend_api_entries")
            if isinstance(be, list):
                candidates.extend([str(x) for x in be])
        # 去重与清理
        out = []
        for x in candidates:
            x = x.strip()
            if x:
                out.append(x)
        # 去重保持顺序
        seen = set()
        dedup = []
        for x in out:
            if x not in seen:
                dedup.append(x)
                seen.add(x)
        return dedup

    def _to_module_path_from_file(self, file_path: Path) -> Optional[str]:
        """
        将仓库内文件路径转换为 Python 导入路径字符串，如：
        f:/repo/api/plugins/smarttavern/example_backend/example_backend.py
        -> api.plugins.smarttavern.example_backend.example_backend
        """
        if not file_path.exists() or not file_path.is_file():
            return None
        if not self._is_under(file_path, self.repo_root):
            return None
        rel = file_path.resolve().relative_to(self.repo_root.resolve())
        # 仅允许 api/* 下的文件
        parts = list(rel.parts)
        if not parts or parts[0] != "api":
            return None
        # 去除 .py 后缀并转点号
        without_suffix = file_path.with_suffix("")
        rel2 = without_suffix.resolve().relative_to(self.repo_root.resolve())
        module = ".".join(rel2.parts)
        return module

    def _impl_module_for_dir(self, dir_path: Path) -> Optional[str]:
        """
        对“目录级”入口，寻找同名实现文件：
        .../<dir_name>/<dir_name>.py 存在时，返回对应导入路径
        """
        if not dir_path.exists() or not dir_path.is_dir():
            return None
        # 必须在 repo_root 下
        if not self._is_under(dir_path, self.repo_root):
            return None
        # 必须在 api/* 下
        rel = dir_path.resolve().relative_to(self.repo_root.resolve())
        parts = list(rel.parts)
        if not parts or parts[0] != "api":
            return None
        impl_file = dir_path / f"{dir_path.name}.py"
        if not impl_file.exists() or not impl_file.is_file():
            return None
        return self._to_module_path_from_file(impl_file)

    def _resolve_entry_to_modules(self, entry: str, plugin_root: Path) -> List[str]:
        """
        将 manifest 中的 entry 解析为“可导入模块路径”列表
        支持：
        - 点式模块：api.plugins.smarttavern.foo.bar
        - 仓库相对文件：api/plugins/smarttavern/foo/bar.py
        - 仓库相对目录：api/plugins/smarttavern/foo
        -（不支持插件根相对的 Python 文件/目录，因为命名空间推断要求模块必须位于 api/* 包）
        """
        entry = entry.strip()
        modules: List[str] = []

        # 1) 点式模块路径
        if entry.startswith("api.plugins.") or entry.startswith("api.modules.") or entry.startswith("api.workflow."):
            modules.append(entry)
            return modules

        # 2) 仓库相对路径（使用 POSIX 或本地分隔符）
        p = Path(entry)
        # 统一到 repo_root 下的绝对路径
        if entry.startswith("api/") or entry.startswith("api\\"):
            abs_path = (self.repo_root / p).resolve()
        else:
            # 不支持非 api/ 前缀的文件或目录（例如插件根相对路径），避免命名空间推断失败
            return modules

        if abs_path.is_file():
            mod = self._to_module_path_from_file(abs_path)
            if mod:
                modules.append(mod)
            return modules

        if abs_path.is_dir():
            mod = self._impl_module_for_dir(abs_path)
            if mod:
                modules.append(mod)
            return modules

        return modules

    def _import_modules(self, module_paths: List[str]) -> Tuple[List[str], List[Tuple[str, str]]]:
        imported = []
        skipped = []
        for mod in module_paths:
            # 安全约束：仅允许 api.* 模块导入
            if not (mod.startswith("api.plugins.") or mod.startswith("api.modules.") or mod.startswith("api.workflow.")):
                skipped.append((mod, "仅允许导入 api.* 包下的模块"))
                continue
            try:
                importlib.import_module(mod)
                imported.append(mod)
            except Exception as e:
                skipped.append((mod, f"导入失败: {type(e).__name__}: {e}"))
        return imported, skipped

    def load(self, project: str = "SmartTavern", manifest_only: bool = True) -> LoaderResult:
        """
        执行按 manifest.json 的选择性加载。
        - manifest_only=True：仅加载声明的 backend_entries；未声明则跳过
        - manifest_only=False：若未声明 backend_entries，则尝试回退：
          - 自动扫描 api/plugins/<project>/<plugin-id> 目录，并导入同名实现文件（如果存在）
        """
        plugins_root = self._plugins_root(project)
        imported_modules: List[str] = []
        skipped_entries: List[Tuple[str, str]] = []
        manifests_read = 0

        if not plugins_root.exists() or not plugins_root.is_dir():
            return LoaderResult(imported_modules, skipped_entries, manifests_read)

        for manifest in plugins_root.rglob("manifest.json"):
            plugin_root = manifest.parent
            # 仅遍历直接位于插件子目录的 manifest（避免递归到非插件子目录）
            # 通过检查相对路径深度简单限制：backend_projects/<Project>/plugins/<plugin>[/...]/manifest.json
            rel = manifest.resolve().relative_to(plugins_root.resolve())
            if len(rel.parts) < 2:
                # 必须至少为 <plugin>/manifest.json
                continue

            data = self._read_manifest(manifest)
            manifests_read += 1

            entries = self._extract_backend_entries(data)
            if not entries:
                if manifest_only:
                    skipped_entries.append((str(manifest), "未声明 backend_entries，且 manifest_only=True，跳过"))
                    continue
                # 回退：尝试 api/plugins/<project>/<plugin> 目录
                # 从插件文件夹名称派生 plugin-id
                plugin_id = plugin_root.name
                fallback_dir = self.repo_root / "api" / "plugins" / project.lower() / plugin_id
                if fallback_dir.exists():
                    mod = self._impl_module_for_dir(fallback_dir)
                    if mod:
                        modules, skips = self._import_modules([mod])
                        imported_modules.extend(modules)
                        skipped_entries.extend(skips)
                else:
                    skipped_entries.append((str(plugin_root), "未声明 backend_entries 且找不到回退目录"))
                continue

            # 解析每个 entry -> module 路径
            module_paths: List[str] = []
            for entry in entries:
                mods = self._resolve_entry_to_modules(entry, plugin_root=plugin_root)
                if not mods:
                    skipped_entries.append((entry, "无法解析为 api.* 下的模块/目录/文件"))
                else:
                    module_paths.extend(mods)

            # 执行导入
            modules, skips = self._import_modules(module_paths)
            imported_modules.extend(modules)
            skipped_entries.extend(skips)

        return LoaderResult(imported_modules=imported_modules, skipped_entries=skipped_entries, manifests_read=manifests_read)


# 便捷函数
def load_backend_plugin_apis(manifest_only: bool = True, project: str = "SmartTavern") -> LoaderResult:
    loader = PluginsBackendLoader()
    return loader.load(project=project, manifest_only=manifest_only)