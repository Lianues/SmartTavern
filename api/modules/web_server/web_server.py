"""
API 封装层：模块能力对外接口 (api/modules)
新规范：斜杠 path + JSON Schema。
"""

from typing import Any, Dict, Optional
import core
from .impl import get_web_server

@core.register_api(
    name="列出前端项目",
    description="列出所有前端项目",
    path="web_server/list_projects",
    input_schema={
        "type": "object",
        "properties": {
            "config_path": {"type": "string"}
        }
    },
    output_schema={
        "type": "object",
        "properties": {
            "projects": {"type": "array", "items": {"type": "object", "additionalProperties": True}}
        }
    }
)
def list_frontend_projects(config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    return server.list_projects()

@core.register_api(
    name="启动前端项目",
    description="启动前端项目",
    path="web_server/start_project",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "open_browser": {"type": "boolean"},
            "config_path": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "project": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success", "project"]
    }
)
def start_frontend_project(project_name: str, open_browser: bool = True, config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    success = server.start_project(project_name, open_browser)
    return {
        "success": success,
        "project": project_name,
        "message": f"项目 {project_name} {'启动成功' if success else '启动失败'}"
    }

@core.register_api(
    name="停止前端项目",
    description="停止前端项目",
    path="web_server/stop_project",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "config_path": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "project": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success", "project"]
    }
)
def stop_frontend_project(project_name: str, config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    success = server.stop_project(project_name)
    return {
        "success": success,
        "project": project_name,
        "message": f"项目 {project_name} {'停止成功' if success else '停止失败'}"
    }

@core.register_api(
    name="重启前端项目",
    description="重启前端项目",
    path="web_server/restart_project",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "config_path": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "project": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success", "project"]
    }
)
def restart_frontend_project(project_name: str, config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    success = server.restart_project(project_name)
    return {
        "success": success,
        "project": project_name,
        "message": f"项目 {project_name} {'重启成功' if success else '重启失败'}"
    }

@core.register_api(
    name="启动所有前端项目",
    description="启动所有启用的前端项目",
    path="web_server/start_all",
    input_schema={
        "type": "object",
        "properties": {
            "config_path": {"type": "string"}
        }
    },
    output_schema={
        "type": "object",
        "properties": {
            "results": {"type": "object", "additionalProperties": {"type": "boolean"}},
            "total": {"type": "integer"},
            "successful": {"type": "integer"}
        },
        "required": ["results", "total", "successful"]
    }
)
def start_all_projects(config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    results = server.start_all_enabled_projects()
    return {
        "results": results,
        "total": len(results),
        "successful": sum(1 for success in results.values() if success)
    }

@core.register_api(
    name="停止所有前端项目",
    description="停止所有前端项目",
    path="web_server/stop_all",
    input_schema={
        "type": "object",
        "properties": {
            "config_path": {"type": "string"}
        }
    },
    output_schema={
        "type": "object",
        "properties": {
            "results": {"type": "object", "additionalProperties": {"type": "boolean"}},
            "total": {"type": "integer"},
            "successful": {"type": "integer"}
        },
        "required": ["results", "total", "successful"]
    }
)
def stop_all_projects(config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    results = server.stop_all_projects()
    return {
        "results": results,
        "total": len(results),
        "successful": sum(1 for success in results.values() if success)
    }

@core.register_api(
    name="获取项目信息",
    description="获取项目详细信息",
    path="web_server/project_info",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "config_path": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "error": {"type": "string"}
        },
        "additionalProperties": True
    }
)
def get_project_information(project_name: str, config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    info = server.get_project_info(project_name)
    return info if info else {"error": f"项目不存在: {project_name}"}

@core.register_api(
    name="获取运行中服务器",
    description="获取所有运行中的服务器",
    path="web_server/running_servers",
    input_schema={
        "type": "object",
        "properties": {
            "config_path": {"type": "string"}
        }
    },
    output_schema={
        "type": "object",
        "properties": {
            "servers": {"type": "array", "items": {"type": "object", "additionalProperties": True}}
        },
        "required": ["servers"]
    }
)
def get_running_servers(config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    return server.dev_server.list_running_servers()

@core.register_api(
    name="创建项目结构",
    description="创建项目基础结构",
    path="web_server/create_structure",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "config_path": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "project": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success", "project"]
    }
)
def create_project_structure(project_name: str, config_path: Optional[str] = None):
    server = get_web_server(config_path=config_path)
    success = server.create_project_structure(project_name)
    return {
        "success": success,
        "project": project_name,
        "message": f"项目结构 {'创建成功' if success else '创建失败'}"
    }

@core.register_api(
    name="加载项目配置",
    description="加载项目特定配置",
    path="web_server/load_project_config",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "project_config_path": {"type": "string"}
        },
        "required": ["project_name", "project_config_path"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "project": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success", "project"]
    }
)
def load_project_config(project_name: str, project_config_path: str):
    server = get_web_server()
    success = server.load_project_specific_config(project_name, project_config_path)
    return {
        "success": success,
        "project": project_name,
        "message": f"项目配置 {'加载成功' if success else '加载失败'}"
    }