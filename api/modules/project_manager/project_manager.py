"""
API 封装层：模块能力对外接口 (api/modules)
新规范：斜杠 path + JSON Schema。
注意：此层仅作为对外 API 适配，实际实现位于 api/modules/project_manager/impl.py
"""

from typing import Any, Dict, Optional
import core
from .impl import (
    get_project_manager,
    import_project as _import_project,
    delete_project as _delete_project,
    update_project_ports as _update_project_ports,
    refresh_projects as _refresh_projects,
    install_project_dependencies as _install_project_dependencies,
    get_project_config_info as _get_project_config_info,
    validate_project_config_script as _validate_project_config_script,
    embed_zip_into_image as _embed_zip_into_image,
    extract_zip_from_image as _extract_zip_from_image,
    import_project_from_image as _import_project_from_image,
    get_managed_projects as _get_managed_projects,
)

# 基础项目生命周期
@core.register_api(
    name="启动被管理的项目",
    description="启动被管理的项目",
    path="project_manager/start_project",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "component": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def start_project(project_name: str, component: str = "all") -> Dict[str, Any]:
    manager = get_project_manager()
    return manager.start_project(project_name, component)

@core.register_api(
    name="停止被管理的项目",
    description="停止被管理的项目",
    path="project_manager/stop_project",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "component": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def stop_project(project_name: str, component: str = "all") -> Dict[str, Any]:
    manager = get_project_manager()
    return manager.stop_project(project_name, component)

@core.register_api(
    name="重启被管理的项目",
    description="重启被管理的项目",
    path="project_manager/restart_project",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "component": {"type": "string"}
        },
        "required": ["project_name"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def restart_project(project_name: str, component: str = "all") -> Dict[str, Any]:
    manager = get_project_manager()
    return manager.restart_project(project_name, component)

# 项目状态与端口
@core.register_api(
    name="获取项目状态",
    description="获取项目状态",
    path="project_manager/get_status",
    input_schema={
        "type": "object",
        "properties": {"project_name": {"type": "string"}}
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def get_status(project_name: Optional[str] = None) -> Dict[str, Any]:
    manager = get_project_manager()
    return manager.get_project_status(project_name)

@core.register_api(
    name="获取端口使用情况",
    description="获取端口使用情况",
    path="project_manager/get_ports",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def get_ports() -> Dict[str, Any]:
    manager = get_project_manager()
    return manager.get_port_usage()

@core.register_api(
    name="执行健康检查",
    description="执行健康检查",
    path="project_manager/health_check",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def health_check() -> Dict[str, Any]:
    manager = get_project_manager()
    results = {}
    for name in manager.projects.keys():
        manager._check_project_health(name)
        results[name] = manager.get_project_status(name)
    return results

@core.register_api(
    name="获取可管理项目列表",
    description="获取可管理项目列表",
    path="project_manager/get_managed_projects",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def get_managed_projects() -> Any:
    return _get_managed_projects()

# 项目导入/删除/配置
@core.register_api(
    name="导入项目",
    description="导入项目（要求根含 modularflow_config.py）",
    path="project_manager/import_project",
    input_schema={
        "type": "object",
        "properties": {"project_archive": {"type": "string"}}
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def import_project(project_archive) -> Dict[str, Any]:
    return _import_project(project_archive)

@core.register_api(
    name="删除项目",
    description="删除项目",
    path="project_manager/delete_project",
    input_schema={
        "type": "object",
        "properties": {"project_name": {"type": "string"}},
        "required": ["project_name"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def delete_project(project_name: str) -> Dict[str, Any]:
    return _delete_project(project_name)

@core.register_api(
    name="更新项目端口配置",
    description="更新项目端口配置",
    path="project_manager/update_ports",
    input_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string"},
            "ports": {"type": "object", "additionalProperties": True}
        },
        "required": ["project_name", "ports"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def update_ports(project_name: str, ports: dict) -> Dict[str, Any]:
    return _update_project_ports(project_name, ports)

@core.register_api(
    name="刷新项目列表",
    description="重新扫描和加载所有项目",
    path="project_manager/refresh_projects",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def refresh_projects() -> Dict[str, Any]:
    return _refresh_projects()

@core.register_api(
    name="安装项目依赖",
    description="安装项目依赖",
    path="project_manager/install_project",
    input_schema={
        "type": "object",
        "properties": {"project_name": {"type": "string"}},
        "required": ["project_name"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def install_project(project_name: str) -> Dict[str, Any]:
    return _install_project_dependencies(project_name)

@core.register_api(
    name="获取项目配置信息",
    description="获取项目配置信息",
    path="project_manager/get_project_config",
    input_schema={
        "type": "object",
        "properties": {"project_name": {"type": "string"}},
        "required": ["project_name"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def get_project_config(project_name: str) -> Dict[str, Any]:
    return _get_project_config_info(project_name)

@core.register_api(
    name="验证项目配置脚本",
    description="验证项目配置脚本",
    path="project_manager/validate_config_script",
    input_schema={
        "type": "object",
        "properties": {"project_name": {"type": "string"}},
        "required": ["project_name"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def validate_config_script(project_name: str) -> Dict[str, Any]:
    return _validate_project_config_script(project_name)

# ZIP 嵌入/提取/导入能力（复用实现层）
@core.register_api(
    name="将zip嵌入PNG",
    description="将zip嵌入PNG并返回base64",
    path="project_manager/embed_zip_into_image",
    input_schema={
        "type": "object",
        "properties": {
            "image": {"type": "string"},
            "archive": {"type": "string"}
        },
        "required": ["image", "archive"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def embed_zip_into_image(image, archive) -> Dict[str, Any]:
    return _embed_zip_into_image(image, archive)

@core.register_api(
    name="从PNG提取zip",
    description="从PNG提取zip并返回清单",
    path="project_manager/extract_zip_from_image",
    input_schema={
        "type": "object",
        "properties": {"image": {"type": "string"}},
        "required": ["image"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def extract_zip_from_image(image) -> Dict[str, Any]:
    return _extract_zip_from_image(image)

@core.register_api(
    name="从图片导入项目",
    description="从PNG反嵌入zip并导入项目",
    path="project_manager/import_project_from_image",
    input_schema={
        "type": "object",
        "properties": {"image": {"type": "string"}},
        "required": ["image"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def import_project_from_image(image) -> Dict[str, Any]:
    return _import_project_from_image(image)

# 新增：后端项目导入（zip）
@core.register_api(
    name="导入后端项目",
    description="导入后端项目（要求根含 modularflow_config.py）",
    path="project_manager/import_backend_project",
    input_schema={
        "type": "object",
        "properties": {"project_archive": {"type": "string"}}
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def import_backend_project(project_archive) -> Dict[str, Any]:
    # 为减少对顶部import块的改动，这里进行局部导入
    from .impl import import_backend_project as _impl_import_backend_project
    return _impl_import_backend_project(project_archive)

# 新增：后端项目导入（从PNG反嵌入zip）
@core.register_api(
    name="从图片导入后端项目",
    description="从PNG反嵌入zip并导入后端项目",
    path="project_manager/import_backend_project_from_image",
    input_schema={
        "type": "object",
        "properties": {"image": {"type": "string"}},
        "required": ["image"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def import_backend_project_from_image(image) -> Dict[str, Any]:
    from .impl import import_backend_project_from_image as _impl_import_backend_project_from_image
    return _impl_import_backend_project_from_image(image)