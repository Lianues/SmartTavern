"""
项目配置管理器

提供统一的项目配置管理功能，支持：
- 项目配置的加载和验证
- 配置文件的自动发现
- 配置合并策略
- 项目特定的配置模板
"""

import json
import logging
from typing import Any, Dict, List, Optional, Union
from pathlib import Path
from dataclasses import dataclass, field
from abc import ABC, abstractmethod

# 配置日志
logger = logging.getLogger(__name__)


@dataclass
class ProjectConfig:
    """项目配置数据类"""
    
    # 项目基本信息
    name: str
    display_name: str
    version: str = "1.0.0"
    description: str = ""
    type: str = "web"
    
    # 前端配置
    frontend: Dict[str, Any] = field(default_factory=dict)
    
    # 后端配置
    backend: Dict[str, Any] = field(default_factory=dict)
    
    # 依赖配置
    dependencies: Dict[str, Any] = field(default_factory=dict)
    
    # 功能特性配置
    features: Dict[str, Any] = field(default_factory=dict)
    
    # 其他配置
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProjectConfig':
        """从字典创建项目配置"""
        project_info = data.get("project", {})
        
        return cls(
            name=project_info.get("name", "unnamed_project"),
            display_name=project_info.get("display_name", "未命名项目"),
            version=project_info.get("version", "1.0.0"),
            description=project_info.get("description", ""),
            type=project_info.get("type", "web"),
            frontend=data.get("frontend", {}),
            backend=data.get("backend", {}),
            dependencies=data.get("dependencies", {}),
            features=data.get("features", {}),
            metadata=data.get("metadata", {})
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "project": {
                "name": self.name,
                "display_name": self.display_name,
                "version": self.version,
                "description": self.description,
                "type": self.type
            },
            "frontend": self.frontend,
            "backend": self.backend,
            "dependencies": self.dependencies,
            "features": self.features,
            "metadata": self.metadata
        }
    
    def get_frontend_port(self) -> int:
        """获取前端端口"""
        return self.frontend.get("port", 3000)
    
    def get_api_port(self) -> int:
        """获取API端口"""
        return self.backend.get("api_gateway", {}).get("port", 8050)
    
    def get_cors_origins(self) -> List[str]:
        """获取CORS源配置"""
        return self.backend.get("api_gateway", {}).get("cors_origins", ["*"])
    
    def is_websocket_enabled(self) -> bool:
        """检查WebSocket是否启用"""
        return self.backend.get("websocket", {}).get("enabled", True)
    
    def get_websocket_path(self) -> str:
        """获取WebSocket路径"""
        return self.backend.get("websocket", {}).get("path", "/ws")


class ProjectConfigManager:
    """
    项目配置管理器
    
    负责项目配置的加载、验证、缓存和管理
    """
    
    def __init__(self):
        self._configs: Dict[str, ProjectConfig] = {}
        self._config_files: Dict[str, str] = {}
    
    def load_project_config(self, config_path: Union[str, Path]) -> Optional[ProjectConfig]:
        """
        加载项目配置
        
        Args:
            config_path: 配置文件路径
            
        Returns:
            项目配置对象，加载失败返回None
        """
        config_file = Path(config_path)
        if not config_file.exists():
            logger.error(f"❌ 配置文件不存在: {config_file}")
            return None
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            
            project_config = ProjectConfig.from_dict(config_data)
            
            # 缓存配置
            self._configs[project_config.name] = project_config
            self._config_files[project_config.name] = str(config_file)
            
            logger.info(f"✓ 项目配置加载成功: {project_config.display_name}")
            return project_config
            
        except Exception as e:
            logger.error(f"❌ 加载项目配置失败 {config_file}: {e}")
            return None
    
    def discover_project_configs(self, search_paths: List[Union[str, Path]]) -> List[ProjectConfig]:
        """
        自动发现项目配置文件
        
        Args:
            search_paths: 搜索路径列表
            
        Returns:
            发现的项目配置列表
        """
        discovered_configs = []
        
        config_filenames = [
            "config.json",
            "project.json",
            "project-config.json"
        ]
        
        for search_path in search_paths:
            search_dir = Path(search_path)
            if not search_dir.exists():
                continue
            
            # 搜索配置文件
            for config_name in config_filenames:
                config_file = search_dir / config_name
                if config_file.exists():
                    project_config = self.load_project_config(config_file)
                    if project_config:
                        discovered_configs.append(project_config)
                        break  # 找到一个配置文件就停止
        
        logger.info(f"✓ 发现 {len(discovered_configs)} 个项目配置")
        return discovered_configs
    
    def get_project_config(self, project_name: str) -> Optional[ProjectConfig]:
        """获取项目配置"""
        return self._configs.get(project_name)
    
    def list_projects(self) -> Dict[str, ProjectConfig]:
        """列出所有项目配置"""
        return self._configs.copy()
    
    def validate_config(self, config: ProjectConfig) -> List[str]:
        """
        验证项目配置
        
        Args:
            config: 项目配置
            
        Returns:
            验证错误列表
        """
        errors = []
        
        # 基本信息验证
        if not config.name:
            errors.append("项目名称不能为空")
        
        if not config.display_name:
            errors.append("项目显示名称不能为空")
        
        # 端口验证
        frontend_port = config.get_frontend_port()
        api_port = config.get_api_port()
        
        if not isinstance(frontend_port, int) or frontend_port <= 0:
            errors.append("前端端口必须是正整数")
        
        if not isinstance(api_port, int) or api_port <= 0:
            errors.append("API端口必须是正整数")
        
        if frontend_port == api_port:
            errors.append("前端端口和API端口不能相同")
        
        # 路径验证
        frontend_path = config.frontend.get("path")
        if frontend_path and not Path(frontend_path).exists():
            errors.append(f"前端路径不存在: {frontend_path}")
        
        return errors
    
    def create_config_template(self, project_name: str, project_type: str = "web") -> Dict[str, Any]:
        """
        创建配置模板
        
        Args:
            project_name: 项目名称
            project_type: 项目类型
            
        Returns:
            配置模板字典
        """
        templates = {
            "web": {
                "project": {
                    "name": project_name,
                    "display_name": f"{project_name}项目",
                    "version": "1.0.0",
                    "description": f"基于ModularFlow Framework的{project_name}项目",
                    "type": "static_web"
                },
                "frontend": {
                    "path": f"frontend_projects/{project_name}",
                    "port": 8080,
                    "auto_open_browser": True,
                    "dev_server": "python_http"
                },
                "backend": {
                    "api_gateway": {
                        "enabled": True,
                        "port": 8050,
                        "cors_origins": [
                            "http://localhost:8080",
                            "http://127.0.0.1:8080"
                        ]
                    },
                    "websocket": {
                        "enabled": True,
                        "path": "/ws"
                    }
                },
                "dependencies": {
                    "required_modules": [
                        "api_gateway_module",
                        "web_server_module"
                    ],
                    "optional_modules": [],
                    "python_packages": [
                        "fastapi",
                        "uvicorn"
                    ]
                },
                "features": {
                    "api_gateway": True,
                    "websocket_communication": True,
                    "static_file_serving": True
                }
            },
            "react": {
                "project": {
                    "name": project_name,
                    "display_name": f"{project_name} React应用",
                    "version": "1.0.0",
                    "description": f"基于React的{project_name}项目",
                    "type": "react"
                },
                "frontend": {
                    "path": f"frontend_projects/{project_name}",
                    "port": 3000,
                    "auto_open_browser": True,
                    "dev_server": "npm",
                    "dev_command": "npm start",
                    "build_command": "npm run build"
                },
                "backend": {
                    "api_gateway": {
                        "enabled": True,
                        "port": 8050,
                        "cors_origins": [
                            "http://localhost:3000",
                            "http://127.0.0.1:3000"
                        ]
                    },
                    "websocket": {
                        "enabled": True,
                        "path": "/ws"
                    }
                },
                "dependencies": {
                    "required_modules": [
                        "api_gateway_module",
                        "web_server_module"
                    ],
                    "python_packages": [
                        "fastapi",
                        "uvicorn"
                    ],
                    "npm_packages": {
                        "react": "^18.0.0",
                        "react-dom": "^18.0.0",
                        "axios": "^1.0.0"
                    }
                },
                "features": {
                    "spa": True,
                    "hot_reload": True,
                    "api_gateway": True,
                    "websocket_communication": True
                }
            }
        }
        
        return templates.get(project_type, templates["web"])
    
    def save_project_config(self, config: ProjectConfig, config_path: Optional[Union[str, Path]] = None) -> bool:
        """
        保存项目配置
        
        Args:
            config: 项目配置
            config_path: 保存路径（可选）
            
        Returns:
            是否保存成功
        """
        if config_path:
            save_path = Path(config_path)
        else:
            # 使用缓存的路径
            cached_path = self._config_files.get(config.name)
            if cached_path:
                save_path = Path(cached_path)
            else:
                save_path = Path(f"backend_projects/{config.name}/config.json")
        
        try:
            # 确保目录存在
            save_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 保存配置
            with open(save_path, 'w', encoding='utf-8') as f:
                json.dump(config.to_dict(), f, indent=2, ensure_ascii=False)
            
            # 更新缓存
            self._configs[config.name] = config
            self._config_files[config.name] = str(save_path)
            
            logger.info(f"✓ 项目配置保存成功: {save_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 保存项目配置失败: {e}")
            return False
    
    def update_project_config(self, project_name: str, updates: Dict[str, Any]) -> Optional[ProjectConfig]:
        """
        更新项目配置
        
        Args:
            project_name: 项目名称
            updates: 更新内容
            
        Returns:
            更新后的配置，失败返回None
        """
        config = self.get_project_config(project_name)
        if not config:
            logger.error(f"❌ 项目配置不存在: {project_name}")
            return None
        
        try:
            # 合并更新
            current_dict = config.to_dict()
            updated_dict = self._deep_merge(current_dict, updates)
            
            # 创建新配置
            updated_config = ProjectConfig.from_dict(updated_dict)
            
            # 验证配置
            errors = self.validate_config(updated_config)
            if errors:
                logger.error(f"❌ 配置验证失败: {errors}")
                return None
            
            # 保存更新
            if self.save_project_config(updated_config):
                logger.info(f"✓ 项目配置更新成功: {project_name}")
                return updated_config
            
        except Exception as e:
            logger.error(f"❌ 更新项目配置失败: {e}")
        
        return None
    
    @staticmethod
    def _deep_merge(base: Dict, overlay: Dict) -> Dict:
        """深度合并字典"""
        result = base.copy()
        for key, value in overlay.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = ProjectConfigManager._deep_merge(result[key], value)
            else:
                result[key] = value
        return result


# 全局项目配置管理器实例
_project_config_manager_instance = None

def get_project_config_manager() -> ProjectConfigManager:
    """获取项目配置管理器单例"""
    global _project_config_manager_instance
    if _project_config_manager_instance is None:
        _project_config_manager_instance = ProjectConfigManager()
    return _project_config_manager_instance


# 便捷函数
def load_project_config(config_path: Union[str, Path]) -> Optional[ProjectConfig]:
    """加载项目配置的便捷函数"""
    manager = get_project_config_manager()
    return manager.load_project_config(config_path)

def discover_projects(search_paths: List[Union[str, Path]]) -> List[ProjectConfig]:
    """发现项目的便捷函数"""
    manager = get_project_config_manager()
    return manager.discover_project_configs(search_paths)

def create_project_template(project_name: str, project_type: str = "web") -> Dict[str, Any]:
    """创建项目模板的便捷函数"""
    manager = get_project_config_manager()
    return manager.create_config_template(project_name, project_type)