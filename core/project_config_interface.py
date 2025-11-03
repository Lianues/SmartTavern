#!/usr/bin/env python3
"""
ModularFlow 项目配置接口规范

定义了统一的项目配置脚本接口，所有前端项目的配置脚本都应该遵循这个接口。
配置脚本应命名为 modularflow_config.py 并放置在项目根目录下。

本文件已简化支持两种写法：
1) 类式配置（传统）：定义 *Config 结尾的类，提供 get_project_info/get_runtime_config/... 方法
2) 常量式配置（推荐简化）：直接在模块级定义常量，框架用 SimpleScriptConfig 适配
   必要常量（可带默认）：
     - FRONTEND_PORT, BACKEND_PORT, WEBSOCKET_PORT
     - PROJECT_NAME, DISPLAY_NAME, PROJECT_TYPE
     - INSTALL_COMMAND, DEV_COMMAND, BUILD_COMMAND
"""

import json
import subprocess
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pathlib import Path


class ProjectConfigInterface(ABC):
    """项目配置接口基类"""

    @abstractmethod
    def get_project_info(self) -> Dict[str, Any]:
        """
        获取项目基本信息
        Returns:
            {
              name, display_name, version, description, type, author, license
            }
        """
        pass

    @abstractmethod
    def get_runtime_config(self) -> Dict[str, Any]:
        """
        获取运行时配置
        Returns:
            {
              port, install_command, dev_command, build_command,
              test_command?, lint_command?
            }
        """
        pass

    @abstractmethod
    def get_dependencies(self) -> Dict[str, Any]:
        """
        获取依赖配置
        Returns:
            {
              required_tools, optional_tools?, node_version?, npm_version?, python_version?
            }
        """
        pass

    @abstractmethod
    def get_api_config(self) -> Dict[str, Any]:
        """
        获取API配置
        Returns:
            {
              api_endpoint, websocket_url, cors_origins
            }
        """
        pass

    def get_env_config(self) -> Dict[str, Dict[str, str]]:
        """
        获取环境变量配置（可选）
        Returns:
            {
              development: {...},
              production: {...}
            }
        """
        return {}

    def check_dependencies(self) -> Dict[str, Any]:
        """
        检查依赖是否满足
        Returns:
            {
              success, missing, warnings
            }
        """
        results = {"success": True, "missing": [], "warnings": []}
        dependencies = self.get_dependencies()

        for tool in dependencies.get("required_tools", []):
            try:
                result = subprocess.run(
                    [tool, "--version"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode != 0:
                    results["success"] = False
                    results["missing"].append(tool)
            except (FileNotFoundError, subprocess.TimeoutExpired):
                results["success"] = False
                results["missing"].append(tool)

        return results

    def install(self) -> bool:
        """
        执行项目安装步骤
        """
        runtime_config = self.get_runtime_config()
        install_command = runtime_config.get("install_command")

        if not install_command:
            return True

        try:
            subprocess.run(install_command.split(), check=True, cwd=Path.cwd())
            return True
        except subprocess.CalledProcessError:
            return False

    def get_full_config(self) -> Dict[str, Any]:
        """
        获取完整的项目配置
        """
        return {
            "project": self.get_project_info(),
            "runtime": self.get_runtime_config(),
            "dependencies": self.get_dependencies(),
            "api": self.get_api_config(),
            "environment": self.get_env_config()
        }


class IndependentConfigWrapper(ProjectConfigInterface):
    """独立配置脚本的包装器（非继承接口的类式配置适配）"""

    def __init__(self, config_instance):
        self.config = config_instance

    def get_project_info(self) -> Dict[str, Any]:
        if hasattr(self.config, 'get_project_info'):
            return self.config.get_project_info()
        return {}

    def get_runtime_config(self) -> Dict[str, Any]:
        if hasattr(self.config, 'get_runtime_config'):
            return self.config.get_runtime_config()
        return {}

    def get_dependencies(self) -> Dict[str, Any]:
        if hasattr(self.config, 'get_dependencies'):
            return self.config.get_dependencies()
        return {"required_tools": [], "optional_tools": []}

    def get_api_config(self) -> Dict[str, Any]:
        if hasattr(self.config, 'get_api_config'):
            return self.config.get_api_config()
        return {}

    def get_env_config(self) -> Dict[str, Dict[str, str]]:
        if hasattr(self.config, 'get_env_config'):
            return self.config.get_env_config()
        return {}

    def check_dependencies(self) -> Dict[str, Any]:
        if hasattr(self.config, 'check_dependencies'):
            return self.config.check_dependencies()
        return super().check_dependencies()

    def install(self) -> bool:
        if hasattr(self.config, 'install'):
            return self.config.install()
        return super().install()


class DefaultProjectConfig(ProjectConfigInterface):
    """默认项目配置实现（自动检测react/vue/next/html等）"""

    def __init__(self, project_name: str, project_path: Path):
        self.project_name = project_name
        self.project_path = project_path
        self._detect_project_type()

    def _detect_project_type(self):
        """自动检测项目类型"""
        if (self.project_path / "package.json").exists():
            try:
                with open(self.project_path / "package.json", 'r', encoding='utf-8') as f:
                    package_json = json.load(f)

                dependencies = package_json.get("dependencies", {})
                dev_dependencies = package_json.get("devDependencies", {})

                if "next" in dependencies or "next" in dev_dependencies:
                    self.project_type = "nextjs"
                elif "react" in dependencies:
                    self.project_type = "react"
                elif "vue" in dependencies:
                    self.project_type = "vue"
                else:
                    self.project_type = "nodejs"
            except:
                self.project_type = "nodejs"
        elif (self.project_path / "index.html").exists():
            self.project_type = "html"
        else:
            self.project_type = "unknown"

    def get_project_info(self) -> Dict[str, Any]:
        return {
            "name": self.project_name,
            "display_name": self.project_name.replace('_', ' ').title(),
            "version": "1.0.0",
            "description": f"基于{self.project_type}的前端项目",
            "type": self.project_type,
            "author": "Unknown",
            "license": "MIT"
        }

    def get_runtime_config(self) -> Dict[str, Any]:
        config = {
            "port": 3000,
            "install_command": "",
            "dev_command": "",
            "build_command": "",
        }

        if self.project_type in ["react", "nextjs", "vue", "nodejs"]:
            config.update({
                "install_command": "npm install",
                "dev_command": "npm run dev",
                "build_command": "npm run build",
                "test_command": "npm test",
                "lint_command": "npm run lint"
            })
        elif self.project_type == "html":
            config["port"] = 8080

        return config

    def get_dependencies(self) -> Dict[str, Any]:
        if self.project_type in ["react", "nextjs", "vue", "nodejs"]:
            return {
                "required_tools": ["node", "npm"],
                "optional_tools": ["yarn", "pnpm"],
                "node_version": ">=16.0.0",
                "npm_version": ">=8.0.0"
            }
        else:
            return {
                "required_tools": [],
                "optional_tools": []
            }

    def get_api_config(self) -> Dict[str, Any]:
        port = self.get_runtime_config()["port"]
        return {
            "api_endpoint": "http://localhost:8050/api",
            "websocket_url": "ws://localhost:8050/ws",
            "cors_origins": [f"http://localhost:{port}"]
        }


class SimpleScriptConfig(ProjectConfigInterface):
    """简化版配置脚本适配器（常量式配置支持）"""

    def __init__(self, project_path: Path, module):
        self.project_path = project_path
        self.module = module

        # 提取模块常量（带默认值）
        self.PROJECT_NAME = getattr(module, "PROJECT_NAME", project_path.name)
        self.DISPLAY_NAME = getattr(module, "DISPLAY_NAME", self.PROJECT_NAME)
        self.PROJECT_TYPE = getattr(module, "PROJECT_TYPE", "html")
        # 新增：版本与描述（允许在配置脚本覆盖）
        self.VERSION = getattr(module, "VERSION", "1.0.0")
        self.DESCRIPTION = getattr(module, "DESCRIPTION", "ModularFlow前端项目")

        self.FRONTEND_PORT = int(getattr(module, "FRONTEND_PORT", 8080))
        self.BACKEND_PORT = int(getattr(module, "BACKEND_PORT", 8050))
        self.WEBSOCKET_PORT = int(getattr(module, "WEBSOCKET_PORT", self.BACKEND_PORT))

        self.INSTALL_COMMAND = getattr(module, "INSTALL_COMMAND", "")
        self.DEV_COMMAND = getattr(module, "DEV_COMMAND", "")
        self.BUILD_COMMAND = getattr(module, "BUILD_COMMAND", "")

    def get_project_info(self) -> Dict[str, Any]:
        return {
            "name": self.PROJECT_NAME,
            "display_name": self.DISPLAY_NAME,
            "version": self.VERSION,
            "description": self.DESCRIPTION,
            "type": self.PROJECT_TYPE,
            "author": "ModularFlow Team",
            "license": "MIT"
        }

    def get_runtime_config(self) -> Dict[str, Any]:
        # dev_command: 若包含 {port} 则格式化，否则按类型给出默认
        dev_cmd = self.DEV_COMMAND or ""
        if "{port}" in dev_cmd:
            dev_cmd = dev_cmd.format(port=self.FRONTEND_PORT)
        elif not dev_cmd and self.PROJECT_TYPE == "html":
            dev_cmd = f"python -m http.server {self.FRONTEND_PORT}"

        return {
            "port": self.FRONTEND_PORT,
            "install_command": self.INSTALL_COMMAND,
            "dev_command": dev_cmd,
            "build_command": self.BUILD_COMMAND,
        }

    def get_dependencies(self) -> Dict[str, Any]:
        # 简化依赖：HTML 仅需 python；其他类型可在项目脚本自行声明
        if self.PROJECT_TYPE == "html":
            return {
                "required_tools": ["python"],
                "optional_tools": [],
                "python_version": ">=3.7",
            }
        # 非HTML项目不强制依赖，由项目自行声明或使用默认空
        return {
            "required_tools": [],
            "optional_tools": [],
        }

    def get_api_config(self) -> Dict[str, Any]:
        return {
            "api_endpoint": f"http://localhost:{self.BACKEND_PORT}/api",
            "websocket_url": f"ws://localhost:{self.WEBSOCKET_PORT}/ws",
            "cors_origins": [f"http://localhost:{self.FRONTEND_PORT}"]
        }


def load_project_config(project_path: Path) -> ProjectConfigInterface:
    """
    加载项目配置（简化版）
    优先顺序：
      1) modularflow_config.py 中的配置类（或独立 Config）
      2) modularflow_config.py 中的模块级常量（SimpleScriptConfig）
      3) 默认配置（自动检测）
    """
    config_file = project_path / "modularflow_config.py"

    if config_file.exists():
        # 动态导入配置脚本
        import importlib.util
        import sys

        spec = importlib.util.spec_from_file_location("project_config", config_file)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            sys.modules["project_config"] = module
            spec.loader.exec_module(module)

            # 1) 类式配置：查找 *Config 结尾类（具备所需方法）
            config_class = None
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (isinstance(attr, type)
                    and attr_name.endswith('Config')
                    and hasattr(attr, 'get_project_info')
                    and hasattr(attr, 'get_runtime_config')):
                    config_class = attr
                    break

            if config_class:
                instance = config_class()
                if not isinstance(instance, ProjectConfigInterface):
                    return IndependentConfigWrapper(instance)
                return instance

            # 2) 常量式配置：存在核心变量则使用 SimpleScriptConfig
            script_vars = ("PROJECT_NAME", "FRONTEND_PORT", "BACKEND_PORT", "DEV_COMMAND", "PROJECT_TYPE")
            if any(hasattr(module, v) for v in script_vars):
                return SimpleScriptConfig(project_path, module)

    # 3) 默认配置
    return DefaultProjectConfig(project_path.name, project_path)


def validate_config_script(config_file: Path) -> Dict[str, Any]:
    """
    验证配置脚本是否符合接口规范
    """
    result = {
        "valid": False,
        "errors": [],
        "warnings": []
    }

    if not config_file.exists():
        result["errors"].append("配置文件不存在")
        return result

    try:
        # 尝试加载配置
        config = load_project_config(config_file.parent)

        # 检查必需方法
        required_methods = [
            "get_project_info",
            "get_runtime_config",
            "get_dependencies",
            "get_api_config"
        ]

        for method in required_methods:
            if not hasattr(config, method):
                result["errors"].append(f"缺少必需方法: {method}")
            else:
                try:
                    getattr(config, method)()
                except Exception as e:
                    result["errors"].append(f"方法 {method} 执行失败: {str(e)}")

        if not result["errors"]:
            result["valid"] = True

    except Exception as e:
        result["errors"].append(f"加载配置脚本失败: {str(e)}")

    return result