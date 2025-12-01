"""
Web服务器模块

提供轻量级Web服务器功能，用于开发和测试环境。
支持静态文件服务、前端项目管理和与API网关的集成。
该模块不再硬编码任何配置，所有配置都从项目配置文件中读取。
"""

import json
import asyncio
import logging
import threading
import subprocess
import time
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime
import webbrowser

try:
    import http.server
    import socketserver
    from urllib.parse import urlparse, parse_qs
except ImportError as e:
    print(f"⚠️ 导入Web服务器模块失败: {e}")

import core

# 配置日志
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


@dataclass
class FrontendProject:
    """前端项目配置"""
    name: str
    display_name: str
    type: str
    path: str
    port: int
    api_endpoint: str = ""
    build_command: str = ""
    dev_command: str = ""
    description: str = ""
    dependencies: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True


@dataclass
class ServerInstance:
    """服务器实例信息"""
    project_name: str
    port: int
    process: Optional[subprocess.Popen] = None
    pid: Optional[int] = None
    status: str = "stopped"  # stopped, starting, running, error
    start_time: Optional[datetime] = None


class StaticFileServer:
    """静态文件服务器"""
    
    def __init__(self, directory: str, port: int):
        self.directory = Path(directory)
        self.port = port
        self.server = None
        self.thread = None
        
    def start(self):
        """启动静态文件服务器"""
        if not self.directory.exists():
            raise FileNotFoundError(f"目录不存在: {self.directory}")
        
        class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, directory=None, **kwargs):
                self.custom_directory = directory
                # 设置 directory 参数以便父类使用
                super().__init__(*args, directory=directory, **kwargs)
            
            def log_message(self, format, *args):
                # 减少日志输出，避免连接异常时的大量错误日志
                return
            
            def handle_one_request(self):
                """处理单个请求，添加连接异常处理"""
                try:
                    super().handle_one_request()
                except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                    # 客户端断开连接，这是正常情况，不需要记录错误
                    pass
                except Exception as e:
                    logger.error(f"HTTP请求处理异常: {e}")
            
            def finish(self):
                """完成请求处理，添加异常处理"""
                try:
                    super().finish()
                except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                    # 连接已断开，忽略
                    pass
            
            def copyfile(self, source, outputfile):
                """复制文件时处理连接异常"""
                try:
                    super().copyfile(source, outputfile)
                except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                    # 客户端断开连接，停止传输
                    pass
        
        def run_server():
            try:
                handler = lambda *args, **kwargs: CustomHTTPRequestHandler(
                    *args, directory=str(self.directory), **kwargs
                )
                with socketserver.TCPServer(("", self.port), handler) as httpd:
                    self.server = httpd
                    logger.info(f"✓ 静态文件服务器启动: http://localhost:{self.port}")
                    logger.info(f"✓ 服务目录: {self.directory}")
                    httpd.serve_forever()
            except Exception as e:
                logger.error(f"❌ 静态文件服务器启动失败: {e}")
        
        self.thread = threading.Thread(target=run_server, daemon=True)
        self.thread.start()
        time.sleep(1)  # 等待服务器启动
        
    def stop(self):
        """停止静态文件服务器"""
        if self.server:
            self.server.shutdown()
            self.server = None
        if self.thread:
            self.thread.join(timeout=5)
            self.thread = None
        logger.info("🛑 静态文件服务器已停止")


class DevServer:
    """开发服务器管理器"""
    
    def __init__(self):
        self.servers: Dict[str, ServerInstance] = {}
        
    def start_project_server(self, project: FrontendProject) -> bool:
        """启动项目开发服务器"""
        if project.name in self.servers:
            server = self.servers[project.name]
            if server.status == "running":
                logger.info(f"⚠️ 项目 {project.name} 的服务器已在运行")
                return True
        
        try:
            project_path = Path(project.path)
            if not project_path.exists():
                logger.error(f"❌ 项目路径不存在: {project_path}")
                return False
            
            # 创建服务器实例
            server_instance = ServerInstance(
                project_name=project.name,
                port=project.port,
                status="starting"
            )
            self.servers[project.name] = server_instance
            
            # 根据项目类型启动相应的开发服务器
            if project.type == "html" or project.type == "static":
                # 静态文件服务器
                static_server = StaticFileServer(str(project_path), project.port)
                static_server.start()
                server_instance.status = "running"
                server_instance.start_time = datetime.now()
                
            elif project.type in ["react", "vue", "angular"]:
                # Node.js项目开发服务器
                if not project.dev_command:
                    logger.error(f"❌ 项目 {project.name} 缺少开发命令")
                    return False
                
                # 启动开发服务器进程
                process = subprocess.Popen(
                    project.dev_command.split(),
                    cwd=str(project_path),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    creationflags=subprocess.CREATE_NEW_CONSOLE if hasattr(subprocess, 'CREATE_NEW_CONSOLE') else 0
                )
                
                server_instance.process = process
                server_instance.pid = process.pid
                server_instance.status = "running"
                server_instance.start_time = datetime.now()
                
            elif project.type == "python":
                # Python开发服务器 (Flask/Django等)
                if not project.dev_command:
                    project.dev_command = f"python -m http.server {project.port}"
                
                process = subprocess.Popen(
                    project.dev_command.split(),
                    cwd=str(project_path),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                
                server_instance.process = process
                server_instance.pid = process.pid
                server_instance.status = "running"
                server_instance.start_time = datetime.now()
            
            logger.info(f"🚀 项目 {project.display_name} 开发服务器启动: http://localhost:{project.port}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 启动项目服务器失败 {project.name}: {e}")
            if project.name in self.servers:
                self.servers[project.name].status = "error"
            return False
        
    def stop_project_server(self, project_name: str) -> bool:
        """停止项目开发服务器"""
        if project_name not in self.servers:
            logger.warning(f"⚠️ 项目 {project_name} 的服务器未运行")
            return False
        
        server = self.servers[project_name]
        
        try:
            if server.process:
                # 强制终止进程及其子进程
                self._terminate_process_tree(server.process)
                logger.info(f"🛑 项目 {project_name} 开发服务器已停止")
            
            server.status = "stopped"
            server.process = None
            server.pid = None
            return True
            
        except Exception as e:
            logger.error(f"❌ 停止项目服务器失败 {project_name}: {e}")
            return False
        
    def get_server_status(self, project_name: str) -> Dict[str, Any]:
        """获取服务器状态"""
        if project_name not in self.servers:
            return {"status": "not_found"}
        
        server = self.servers[project_name]
        return {
            "status": server.status,
            "port": server.port,
            "pid": server.pid,
            "start_time": server.start_time.isoformat() if server.start_time else None,
            "uptime": (datetime.now() - server.start_time).total_seconds() if server.start_time else None
        }
    
    def list_running_servers(self) -> List[Dict[str, Any]]:
        """列出所有运行中的服务器"""
        running_servers = []
        for name, server in self.servers.items():
            if server.status == "running":
                running_servers.append({
                    "name": name,
                    "port": server.port,
                    "pid": server.pid,
                    "start_time": server.start_time.isoformat() if server.start_time else None,
                    "url": f"http://localhost:{server.port}"
                })
        return running_servers
    
    def _terminate_process_tree(self, process: subprocess.Popen):
        """终止进程及其所有子进程"""
        try:
            if process.poll() is None:  # 进程仍在运行
                # 在Windows上，尝试终止整个进程树
                if hasattr(subprocess, 'CREATE_NEW_CONSOLE') and os.name == 'nt':
                    try:
                        # 使用taskkill命令终止进程树
                        subprocess.run(
                            ['taskkill', '/F', '/T', '/PID', str(process.pid)],
                            check=False,
                            capture_output=True
                        )
                        logger.info(f"✓ 使用taskkill终止进程树 PID: {process.pid}")
                    except Exception as e:
                        logger.warning(f"taskkill失败，使用标准方法: {e}")
                        process.terminate()
                        process.wait(timeout=10)
                else:
                    # Unix系统使用进程组终止
                    try:
                        import signal
                        import os
                        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                        process.wait(timeout=10)
                    except Exception:
                        process.terminate()
                        process.wait(timeout=10)
        except Exception as e:
            logger.error(f"终止进程树失败: {e}")
            # 最后尝试强制终止
            try:
                process.kill()
            except:
                pass


class WebServer:
    """
    Web服务器主类
    
    管理前端项目配置、开发服务器启动和静态文件服务。
    所有配置都从项目配置文件中读取，不再硬编码。
    """
    
    def __init__(self, config_path: Optional[str] = None, project_config: Optional[Dict[str, Any]] = None):
        """
        初始化Web服务器
        
        Args:
            config_path: 项目配置文件路径（可选）
            project_config: 直接传入的项目配置（可选）
        """
        self.projects: Dict[str, FrontendProject] = {}
        self.dev_server = DevServer()
        self.static_servers: Dict[str, StaticFileServer] = {}
        self.config_path = config_path
        self.global_config = {}
        
        # 加载前端项目配置
        if project_config:
            self._load_config_from_dict(project_config)
        else:
            self._load_frontend_projects(config_path)
    
    def _load_config_from_dict(self, config_data: Dict[str, Any]):
        """从字典加载配置"""
        try:
            # 加载全局配置
            self.global_config = config_data.get("global_config", {})
            
            # 加载项目列表
            for project_data in config_data.get("projects", []):
                project = FrontendProject(**project_data)
                self.projects[project.name] = project
            
            logger.info(f"✓ 从配置字典加载了 {len(self.projects)} 个前端项目配置")
            
        except Exception as e:
            logger.error(f"❌ 加载配置字典失败: {e}")
    
    def _load_frontend_projects(self, config_path: Optional[str] = None):
        """从文件加载前端项目配置"""
        if not config_path:
            # 尝试多个可能的配置文件位置
            possible_paths = [
                "frontend_projects/frontend-projects.json",
                "frontend-projects.json",
                "config/frontend-projects.json"
            ]
            
            config_file_path = None
            for path in possible_paths:
                if Path(path).exists():
                    config_file_path = Path(path)
                    break
        else:
            config_file_path = Path(config_path)
        
        if config_file_path and config_file_path.exists():
            try:
                with open(config_file_path, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                
                self._load_config_from_dict(config_data)
                self.config_path = str(config_file_path)
                logger.info(f"✓ 从文件加载前端项目配置: {config_file_path}")
                
            except Exception as e:
                logger.error(f"❌ 加载前端项目配置失败: {e}")
        else:
            logger.warning("⚠️ 未找到前端项目配置文件")
    
    def load_project_specific_config(self, project_name: str, project_config_path: str) -> bool:
        """
        加载项目特定配置
        
        Args:
            project_name: 项目名称
            project_config_path: 项目配置文件路径
            
        Returns:
            是否加载成功
        """
        config_path = Path(project_config_path)
        if not config_path.exists():
            logger.error(f"❌ 项目配置文件不存在: {project_config_path}")
            return False
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                project_config = json.load(f)
            
            # 解析项目配置
            frontend_config = project_config.get("frontend", {})
            
            if frontend_config:
                # 创建项目对象
                project = FrontendProject(
                    name=project_name,
                    display_name=project_config.get("project", {}).get("display_name", project_name),
                    type=project_config.get("project", {}).get("type", "html"),
                    path=frontend_config.get("path", f"frontend_projects/{project_name}"),
                    port=frontend_config.get("port", 3000),
                    api_endpoint=project_config.get("backend", {}).get("api_gateway", {}).get("endpoint", ""),
                    dev_command=frontend_config.get("dev_command", ""),
                    description=project_config.get("project", {}).get("description", "")
                )
                
                self.projects[project_name] = project
                logger.info(f"✓ 加载项目配置: {project_name}")
                return True
            
        except Exception as e:
            logger.error(f"❌ 加载项目配置失败 {project_name}: {e}")
        
        return False
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """列出所有前端项目"""
        projects_info = []
        for name, project in self.projects.items():
            project_info = {
                "name": project.name,
                "display_name": project.display_name,
                "type": project.type,
                "path": project.path,
                "port": project.port,
                "api_endpoint": project.api_endpoint,
                "enabled": project.enabled,
                "description": project.description,
                "server_status": self.dev_server.get_server_status(project.name)
            }
            projects_info.append(project_info)
        return projects_info
    
    def start_project(self, project_name: str, open_browser: bool = None) -> bool:
        """启动指定项目"""
        if project_name not in self.projects:
            logger.error(f"❌ 项目不存在: {project_name}")
            return False
        
        project = self.projects[project_name]
        if not project.enabled:
            logger.warning(f"⚠️ 项目 {project_name} 已禁用")
            return False
        
        # 启动开发服务器
        success = self.dev_server.start_project_server(project)
        
        # 检查是否需要自动打开浏览器
        if success and open_browser is not False:  # 默认打开，除非明确指定不打开
            # 延迟打开浏览器
            def open_browser_delayed():
                time.sleep(2)
                try:
                    webbrowser.open(f"http://localhost:{project.port}")
                    logger.info(f"🌐 浏览器已打开: http://localhost:{project.port}")
                except Exception as e:
                    logger.warning(f"⚠️ 无法自动打开浏览器: {e}")
            
            threading.Thread(target=open_browser_delayed, daemon=True).start()
        
        return success
    
    def stop_project(self, project_name: str) -> bool:
        """停止指定项目"""
        return self.dev_server.stop_project_server(project_name)
    
    def restart_project(self, project_name: str) -> bool:
        """重启指定项目"""
        self.stop_project(project_name)
        time.sleep(1)
        return self.start_project(project_name, open_browser=False)
    
    def start_all_enabled_projects(self) -> Dict[str, bool]:
        """启动所有启用的项目"""
        results = {}
        for name, project in self.projects.items():
            if project.enabled:
                results[name] = self.start_project(name, open_browser=False)
        return results
    
    def stop_all_projects(self) -> Dict[str, bool]:
        """停止所有项目"""
        results = {}
        for name in self.projects:
            results[name] = self.stop_project(name)
        return results
    
    def get_project_info(self, project_name: str) -> Optional[Dict[str, Any]]:
        """获取项目详细信息"""
        if project_name not in self.projects:
            return None
        
        project = self.projects[project_name]
        project_path = Path(project.path)
        
        return {
            "name": project.name,
            "display_name": project.display_name,
            "type": project.type,
            "path": project.path,
            "port": project.port,
            "api_endpoint": project.api_endpoint,
            "build_command": project.build_command,
            "dev_command": project.dev_command,
            "description": project.description,
            "dependencies": project.dependencies,
            "enabled": project.enabled,
            "path_exists": project_path.exists(),
            "files_count": len(list(project_path.rglob("*"))) if project_path.exists() else 0,
            "server_status": self.dev_server.get_server_status(project_name)
        }
    
    def create_project_structure(self, project_name: str) -> bool:
        """创建项目基础结构"""
        if project_name not in self.projects:
            logger.error(f"❌ 项目配置不存在: {project_name}")
            return False
        
        project = self.projects[project_name]
        project_path = Path(project.path)
        
        try:
            # 创建项目目录
            project_path.mkdir(parents=True, exist_ok=True)
            
            # 根据项目类型创建基础文件
            if project.type == "html" or project.type == "static":
                self._create_html_project_structure(project_path, project)
            elif project.type == "react":
                self._create_react_project_info(project_path, project)
            elif project.type == "vue":
                self._create_vue_project_info(project_path, project)
            
            logger.info(f"✓ 项目结构创建完成: {project_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 创建项目结构失败 {project_name}: {e}")
            return False
    
    def _create_html_project_structure(self, project_path: Path, project: FrontendProject):
        """创建HTML项目基础结构"""
        # 创建基础目录
        (project_path / "css").mkdir(exist_ok=True)
        (project_path / "js").mkdir(exist_ok=True)
        (project_path / "assets").mkdir(exist_ok=True)
        
        # 如果不存在index.html，则创建
        if not (project_path / "index.html").exists():
            html_content = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{project.display_name}</title>
    <link rel="stylesheet" href="css/main.css">
</head>
<body>
    <div class="container">
        <h1>{project.display_name}</h1>
        <p>{project.description}</p>
        <p>项目类型: {project.type}</p>
        <p>API端点: <code>{project.api_endpoint}</code></p>
    </div>
    <script src="js/main.js"></script>
</body>
</html>'''
            
            with open(project_path / "index.html", 'w', encoding='utf-8') as f:
                f.write(html_content)
    
    def _create_react_project_info(self, project_path: Path, project: FrontendProject):
        """创建React项目信息文件"""
        package_json = {
            "name": project.name.replace('_', '-'),
            "version": "1.0.0",
            "private": True,
            "dependencies": project.dependencies or {
                "react": "^18.0.0",
                "react-dom": "^18.0.0",
                "axios": "^1.0.0"
            },
            "scripts": {
                "start": "react-scripts start",
                "build": "react-scripts build",
                "test": "react-scripts test",
                "eject": "react-scripts eject"
            },
            "browserslist": {
                "production": [">0.2%", "not dead", "not op_mini all"],
                "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
            }
        }
        
        with open(project_path / "package.json", 'w', encoding='utf-8') as f:
            json.dump(package_json, f, indent=2, ensure_ascii=False)
    
    def _create_vue_project_info(self, project_path: Path, project: FrontendProject):
        """创建Vue项目信息文件"""
        package_json = {
            "name": project.name.replace('_', '-'),
            "version": "1.0.0",
            "private": True,
            "dependencies": project.dependencies or {
                "vue": "^3.0.0",
                "axios": "^1.0.0"
            },
            "devDependencies": {
                "@vitejs/plugin-vue": "^4.0.0",
                "vite": "^4.0.0"
            },
            "scripts": {
                "dev": "vite",
                "build": "vite build",
                "preview": "vite preview"
            }
        }
        
        with open(project_path / "package.json", 'w', encoding='utf-8') as f:
            json.dump(package_json, f, indent=2, ensure_ascii=False)


# 全局Web服务器实例
_web_server_instance = None

def get_web_server(config_path: Optional[str] = None, project_config: Optional[Dict[str, Any]] = None) -> WebServer:
    """获取Web服务器单例"""
    global _web_server_instance
    if _web_server_instance is None:
        _web_server_instance = WebServer(config_path=config_path, project_config=project_config)
    return _web_server_instance

def create_web_server_for_project(project_config_path: str) -> WebServer:
    """为特定项目创建Web服务器实例"""
    return WebServer(config_path=project_config_path)


# 内部实现供 API 层调用（对外 API 暴露统一在 api/modules/web_server/web_server.py）


if __name__ == "__main__":
    # 直接运行时启动Web服务器管理界面
    server = get_web_server()
    projects = server.list_projects()
    
    print("🌐 ModularFlow Web服务器管理")
    print("=" * 40)
    
    if projects:
        for project in projects:
            print(f"📁 {project['display_name']} ({project['name']})")
            print(f"   类型: {project['type']}")
            print(f"   路径: {project['path']}")
            print(f"   端口: {project['port']}")
            print(f"   状态: {project['server_status']['status']}")
            print()
    else:
        print("⚠️ 没有找到前端项目配置")