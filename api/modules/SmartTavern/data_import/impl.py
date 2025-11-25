# -*- coding: utf-8 -*-
"""
SmartTavern.data_import 实现层

职责
- 提供通用的数据导入/导出功能
- 支持从 ZIP 压缩包、PNG 嵌入数据、JSON 文件导入
- 支持将数据导出为 ZIP 或嵌入到 PNG 图片中
- 支持导入/导出预设、角色卡、世界书、用户画像、正则规则等类型

说明
- 本文件仅提供纯实现函数；API 注册在同目录 data_import.py 中完成
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import json
import base64
import zipfile
import tempfile
import shutil
import zlib
import struct
import os
import uuid
import io
from datetime import datetime


# ---------- 常量定义 ----------

# 支持的数据类型及其对应的目录和文件名
DATA_TYPE_CONFIG = {
    "preset": {
        "dir": "presets",
        "main_file": "preset.json",
        "name_field": "name",
    },
    "character": {
        "dir": "characters",
        "main_file": "character.json",
        "name_field": "name",
    },
    "worldbook": {
        "dir": "world_books",
        "main_file": "worldbook.json",
        "name_field": "name",
    },
    "persona": {
        "dir": "personas",
        "main_file": "persona.json",
        "name_field": "name",
    },
    "regex_rule": {
        "dir": "regex_rules",
        "main_file": "regex_rule.json",
        "name_field": "name",
    },
    "llm_config": {
        "dir": "llm_configs",
        "main_file": "llm_config.json",
        "name_field": "name",
    },
    "plugin": {
        "dir": "plugins",
        "main_file": "manifest.json",
        "name_field": "name",
        "register_enabled": True,  # 标记需要注册到 plugins_switch.json
    },
}

# PNG 自定义数据块名称（与 image_binding 模块保持一致）
PNG_CHUNK_NAME = b'stDa'

# 元数据文件名（ZIP 内的标记文件）
META_FILENAME = ".st_meta.json"

# 当前版本
EXPORT_VERSION = "1.0.0"


# ---------- 路径与工具 ----------

def _repo_root() -> Path:
    """
    返回仓库根目录（基于当前文件层级向上回溯）
    当前文件位于: repo_root/api/modules/SmartTavern/data_import/impl.py
    parents[4] => repo_root
    """
    return Path(__file__).resolve().parents[4]


def _data_root() -> Path:
    """返回数据根目录"""
    return _repo_root() / "backend_projects" / "SmartTavern" / "data"


def _plugins_root() -> Path:
    """返回插件根目录"""
    return _repo_root() / "backend_projects" / "SmartTavern" / "plugins"


def _plugins_switch_file() -> Path:
    """返回插件开关配置文件路径"""
    return _plugins_root() / "plugins_switch.json"


def _path_rel_to_root(p: Path, root: Path) -> str:
    """
    统一返回 POSIX 风格路径（使用 '/' 分隔）
    """
    try:
        return p.relative_to(root).as_posix()
    except Exception:
        try:
            return p.resolve().as_posix()
        except Exception:
            return str(p).replace("\\", "/")


def _safe_read_json(p: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """安全读取 JSON 文件"""
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def _write_json(p: Path, data: Any) -> Optional[str]:
    """写入 JSON 文件"""
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        return None
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def _generate_unique_name(base_name: str, existing_names: set) -> str:
    """生成唯一名称，避免冲突"""
    if base_name not in existing_names:
        return base_name
    
    counter = 1
    while f"{base_name}_{counter}" in existing_names:
        counter += 1
    return f"{base_name}_{counter}"


def _sanitize_folder_name(name: str) -> str:
    """清理文件夹名称，移除不安全字符"""
    # 移除或替换不安全的文件名字符
    unsafe_chars = '<>:"/\\|?*'
    result = name
    for char in unsafe_chars:
        result = result.replace(char, '_')
    # 移除前后空白
    result = result.strip()
    # 如果名称为空，使用默认名称
    if not result:
        result = f"imported_{uuid.uuid4().hex[:8]}"
    return result


def _register_plugin_enabled(plugin_name: str) -> Optional[str]:
    """
    将插件添加到 plugins_switch.json 的 enabled 列表中
    
    Args:
        plugin_name: 插件文件夹名称
        
    Returns:
        错误信息，成功返回 None
    """
    switch_file = _plugins_switch_file()
    
    try:
        # 读取现有配置
        if switch_file.exists():
            with switch_file.open("r", encoding="utf-8") as f:
                switch_data = json.load(f)
        else:
            switch_data = {"enabled": [], "disabled": []}
        
        # 确保 enabled 和 disabled 列表存在
        if "enabled" not in switch_data:
            switch_data["enabled"] = []
        if "disabled" not in switch_data:
            switch_data["disabled"] = []
        
        # 如果插件不在 enabled 列表中，添加它
        if plugin_name not in switch_data["enabled"]:
            switch_data["enabled"].append(plugin_name)
        
        # 如果插件在 disabled 列表中，移除它
        if plugin_name in switch_data["disabled"]:
            switch_data["disabled"].remove(plugin_name)
        
        # 写回配置文件
        switch_file.parent.mkdir(parents=True, exist_ok=True)
        with switch_file.open("w", encoding="utf-8") as f:
            json.dump(switch_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        
        return None
    except Exception as e:
        return f"注册插件失败: {type(e).__name__}: {e}"


# ---------- 文件类型检测 ----------

def _detect_file_type(filename: str, data: bytes) -> str:
    """
    检测文件类型
    
    Args:
        filename: 文件名
        data: 文件二进制内容
        
    Returns:
        文件类型: 'zip', 'png', 'json', 'unknown'
    """
    # 检查文件扩展名
    ext = Path(filename).suffix.lower()
    
    # 检查魔数
    if data[:4] == b'PK\x03\x04':
        return 'zip'
    elif data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    elif ext == '.json':
        return 'json'
    
    # 尝试解析为 JSON
    try:
        json.loads(data.decode('utf-8'))
        return 'json'
    except:
        pass
    
    return 'unknown'


# ---------- PNG 数据块操作 ----------

def _read_png_chunks(png_data: bytes) -> List[Tuple[bytes, bytes]]:
    """
    读取 PNG 图片的所有数据块
    
    Args:
        png_data: PNG 图片的二进制数据
        
    Returns:
        数据块列表，每个元素为 (chunk_type, chunk_data) 元组
    """
    if png_data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError("无效的 PNG 文件")
    
    chunks = []
    pos = 8  # 跳过 PNG 文件头
    
    while pos < len(png_data):
        # 读取数据块长度（4字节）
        chunk_length = struct.unpack(">I", png_data[pos:pos+4])[0]
        pos += 4
        
        # 读取数据块类型（4字节）
        chunk_type = png_data[pos:pos+4]
        pos += 4
        
        # 读取数据块内容
        chunk_data = png_data[pos:pos+chunk_length]
        pos += chunk_length
        
        # 跳过 CRC 校验（4字节）
        pos += 4
        
        chunks.append((chunk_type, chunk_data))
        
        # 检查是否为 IEND 块（PNG 文件结束标记）
        if chunk_type == b'IEND':
            break
    
    return chunks


def _create_png_chunk(chunk_type: bytes, chunk_data: bytes) -> bytes:
    """
    创建 PNG 数据块
    
    Args:
        chunk_type: 数据块类型（4字节）
        chunk_data: 数据块内容
        
    Returns:
        完整的 PNG 数据块二进制数据
    """
    chunk = struct.pack(">I", len(chunk_data))  # 长度（4字节）
    chunk += chunk_type  # 类型（4字节）
    chunk += chunk_data  # 数据
    
    # 计算 CRC32 校验值
    crc = zlib.crc32(chunk_type + chunk_data) & 0xffffffff
    chunk += struct.pack(">I", crc)  # CRC（4字节）
    
    return chunk


def _extract_data_from_png(png_data: bytes) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    从 PNG 图片中提取嵌入的数据
    
    Args:
        png_data: PNG 图片的二进制数据
        
    Returns:
        (提取的数据, 错误信息)
    """
    try:
        chunks = _read_png_chunks(png_data)
        
        for chunk_type, chunk_data in chunks:
            if chunk_type == PNG_CHUNK_NAME:
                # 解压缩数据
                try:
                    decompressed_data = zlib.decompress(chunk_data)
                    binding_data = json.loads(decompressed_data.decode('utf-8'))
                    return binding_data, None
                except (zlib.error, json.JSONDecodeError) as e:
                    return None, f"无法解析 PNG 中的嵌入数据: {str(e)}"
        
        return None, "PNG 图片中未找到嵌入数据"
    except Exception as e:
        return None, f"读取 PNG 失败: {type(e).__name__}: {e}"


# ---------- ZIP 数据提取 ----------

def _extract_data_from_zip(zip_data: bytes, data_type: str) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, bytes]], Optional[str]]:
    """
    从 ZIP 压缩包中提取数据
    
    Args:
        zip_data: ZIP 文件的二进制数据
        data_type: 数据类型
        
    Returns:
        (主 JSON 数据, 附加文件字典, 错误信息)
    """
    try:
        config = DATA_TYPE_CONFIG.get(data_type)
        if not config:
            return None, None, f"不支持的数据类型: {data_type}"
        
        main_file = config["main_file"]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # 解压 ZIP 文件
            with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zf:
                zf.extractall(temp_path)
            
            # 查找主 JSON 文件
            main_json_path = None
            
            # 首先在根目录查找
            root_main = temp_path / main_file
            if root_main.exists():
                main_json_path = root_main
            else:
                # 在子目录中查找
                for item in temp_path.iterdir():
                    if item.is_dir():
                        sub_main = item / main_file
                        if sub_main.exists():
                            main_json_path = sub_main
                            break
                
                # 如果还没找到，查找任何 .json 文件
                if main_json_path is None:
                    json_files = list(temp_path.rglob("*.json"))
                    # 排除元数据文件
                    json_files = [f for f in json_files if f.name != META_FILENAME]
                    if json_files:
                        main_json_path = json_files[0]
            
            if main_json_path is None:
                return None, None, f"ZIP 中未找到 {main_file} 或任何 JSON 文件"
            
            # 读取主 JSON 文件
            main_data, err = _safe_read_json(main_json_path)
            if err:
                return None, None, f"读取 JSON 失败: {err}"
            
            # 收集附加文件（图片等）
            extra_files = {}
            base_dir = main_json_path.parent
            
            for item in base_dir.iterdir():
                if item.is_file() and item != main_json_path and item.name != META_FILENAME:
                    # 读取文件内容
                    try:
                        extra_files[item.name] = item.read_bytes()
                    except Exception:
                        pass
            
            return main_data, extra_files, None
            
    except zipfile.BadZipFile:
        return None, None, "无效的 ZIP 文件"
    except Exception as e:
        return None, None, f"解压 ZIP 失败: {type(e).__name__}: {e}"


# ---------- 导入实现 ----------

def import_data_impl(
    data_type: str,
    file_content_base64: str,
    filename: str,
    target_name: Optional[str] = None,
    overwrite: bool = False
) -> Dict[str, Any]:
    """
    导入数据的主实现函数
    
    Args:
        data_type: 数据类型 (preset, character, worldbook, persona, regex_rule, llm_config)
        file_content_base64: Base64 编码的文件内容
        filename: 原始文件名
        target_name: 目标名称（可选，默认从数据中提取）
        overwrite: 是否覆盖已存在的数据
        
    Returns:
        导入结果
    """
    root = _repo_root()
    data_root = _data_root()
    
    # 验证数据类型
    config = DATA_TYPE_CONFIG.get(data_type)
    if not config:
        return {
            "success": False,
            "error": "INVALID_TYPE",
            "message": f"不支持的数据类型: {data_type}，支持的类型: {list(DATA_TYPE_CONFIG.keys())}"
        }
    
    # 特殊处理：插件类型使用不同的根目录
    is_plugin = data_type == "plugin"
    
    # 解码文件内容
    try:
        file_data = base64.b64decode(file_content_base64)
    except Exception as e:
        return {
            "success": False,
            "error": "DECODE_FAILED",
            "message": f"Base64 解码失败: {str(e)}"
        }
    
    # 检测文件类型
    file_type = _detect_file_type(filename, file_data)
    
    main_data = None
    extra_files = {}
    
    # 根据文件类型提取数据
    if file_type == 'json':
        # 直接解析 JSON
        try:
            main_data = json.loads(file_data.decode('utf-8'))
        except Exception as e:
            return {
                "success": False,
                "error": "PARSE_FAILED",
                "message": f"JSON 解析失败: {str(e)}"
            }
    
    elif file_type == 'zip':
        # 从 ZIP 提取
        main_data, extra_files, err = _extract_data_from_zip(file_data, data_type)
        if err:
            return {
                "success": False,
                "error": "EXTRACT_FAILED",
                "message": err
            }
        extra_files = extra_files or {}
    
    elif file_type == 'png':
        # 从 PNG 提取嵌入数据
        binding_data, err = _extract_data_from_png(file_data)
        if err:
            return {
                "success": False,
                "error": "EXTRACT_FAILED",
                "message": err
            }
        
        # 保存原始 PNG 数据，稍后判断是否需要用作 icon
        original_png_data = file_data
        
        # 处理新格式（包含 data 字段的 ZIP 数据）
        if binding_data and "data" in binding_data:
            # 新导出格式：包含完整 ZIP 数据
            try:
                zip_data = base64.b64decode(binding_data["data"])
                embedded_type = binding_data.get("type", data_type)
                
                # 如果嵌入的类型与请求的类型不匹配，给出警告但继续处理
                if embedded_type != data_type:
                    pass  # 可以在返回结果中添加警告
                
                main_data, extra_files, err = _extract_data_from_zip(zip_data, data_type)
                if err:
                    return {
                        "success": False,
                        "error": "EXTRACT_FAILED",
                        "message": err
                    }
                extra_files = extra_files or {}
                # 如果 ZIP 中没有 icon 文件，才使用导入的 PNG 作为 icon
                if not any(f.lower() in ('icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp') for f in extra_files.keys()):
                    extra_files["icon.png"] = original_png_data
            except Exception as e:
                return {
                    "success": False,
                    "error": "EXTRACT_FAILED",
                    "message": f"解析 PNG 嵌入数据失败: {str(e)}"
                }
        
        # 处理 image_binding 格式的数据（旧格式兼容）
        elif binding_data and "files" in binding_data:
            files_list = binding_data.get("files", [])
            
            # 查找匹配数据类型的文件
            for file_info in files_list:
                file_type_tag = file_info.get("type", "")
                file_content_b64 = file_info.get("content", "")
                
                # 根据类型标签匹配
                type_mapping = {
                    "PRESET": "preset",
                    "CHARACTER": "character",
                    "WORLD_BOOK": "worldbook",
                    "PERSONA": "persona",
                    "REGEX": "regex_rule",
                }
                
                mapped_type = type_mapping.get(file_type_tag, "")
                
                if mapped_type == data_type or not mapped_type:
                    # 解码文件内容
                    try:
                        content_bytes = base64.b64decode(file_content_b64)
                        main_data = json.loads(content_bytes.decode('utf-8'))
                        break
                    except Exception:
                        continue
            
            if main_data is None:
                return {
                    "success": False,
                    "error": "NO_MATCHING_DATA",
                    "message": f"PNG 中未找到类型为 {data_type} 的数据"
                }
            # 旧格式兼容：如果没有 icon，才使用导入的 PNG 作为 icon
            if not any(f.lower() in ('icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp') for f in extra_files.keys()):
                extra_files["icon.png"] = original_png_data
        else:
            return {
                "success": False,
                "error": "INVALID_BINDING",
                "message": "PNG 中的嵌入数据格式无效"
            }
    
    else:
        return {
            "success": False,
            "error": "UNSUPPORTED_FORMAT",
            "message": f"不支持的文件格式: {file_type}"
        }
    
    # 确定目标名称
    name_field = config["name_field"]
    if target_name:
        final_name = target_name
    elif isinstance(main_data, dict) and name_field in main_data:
        final_name = str(main_data[name_field])
    else:
        # 使用文件名作为名称
        final_name = Path(filename).stem
    
    # 清理文件夹名称
    folder_name = _sanitize_folder_name(final_name)
    
    # 获取目标目录（插件使用单独的目录）
    if is_plugin:
        target_dir = _plugins_root()
    else:
        target_dir = data_root / config["dir"]
    target_folder = target_dir / folder_name
    
    # 检查是否已存在
    if target_folder.exists():
        if not overwrite:
            # 获取已存在的文件夹名称列表
            existing_names = {d.name for d in target_dir.iterdir() if d.is_dir()}
            folder_name = _generate_unique_name(folder_name, existing_names)
            target_folder = target_dir / folder_name
        else:
            # 删除已存在的目录
            shutil.rmtree(target_folder)
    
    # 创建目标文件夹
    target_folder.mkdir(parents=True, exist_ok=True)
    
    # 写入主 JSON 文件
    main_file_path = target_folder / config["main_file"]
    err = _write_json(main_file_path, main_data)
    if err:
        return {
            "success": False,
            "error": "WRITE_FAILED",
            "message": f"写入文件失败: {err}"
        }
    
    # 写入附加文件
    for extra_name, extra_content in extra_files.items():
        extra_path = target_folder / extra_name
        try:
            extra_path.write_bytes(extra_content)
        except Exception as e:
            # 附加文件写入失败不影响主导入
            pass
    
    # 特殊处理：插件导入后自动注册到 enabled 列表
    register_error = None
    if is_plugin and config.get("register_enabled"):
        register_error = _register_plugin_enabled(folder_name)
    
    # 返回结果
    result = {
        "success": True,
        "message": f"成功导入 {data_type}",
        "data_type": data_type,
        "name": final_name if isinstance(main_data, dict) and name_field in main_data else folder_name,
        "folder": folder_name,
        "file": _path_rel_to_root(main_file_path, root),
        "extra_files": list(extra_files.keys()),
    }
    
    # 如果是插件，添加注册结果
    if is_plugin:
        result["registered"] = register_error is None
        if register_error:
            result["register_warning"] = register_error
    
    return result


def get_supported_types_impl() -> Dict[str, Any]:
    """
    获取支持的数据类型列表
    
    Returns:
        支持的数据类型信息
    """
    types_info = []
    for type_key, config in DATA_TYPE_CONFIG.items():
        types_info.append({
            "type": type_key,
            "dir": config["dir"],
            "main_file": config["main_file"],
        })
    
    return {
        "success": True,
        "types": types_info,
        "formats": ["json", "zip", "png"],
    }


def check_name_exists_impl(data_type: str, name: str) -> Dict[str, Any]:
    """
    检查名称是否已存在
    
    Args:
        data_type: 数据类型
        name: 要检查的名称
        
    Returns:
        检查结果
    """
    config = DATA_TYPE_CONFIG.get(data_type)
    if not config:
        return {
            "success": False,
            "error": "INVALID_TYPE",
            "message": f"不支持的数据类型: {data_type}"
        }
    
    # 插件使用单独的目录
    if data_type == "plugin":
        target_dir = _plugins_root()
    else:
        data_root = _data_root()
        target_dir = data_root / config["dir"]
    
    # 清理名称
    folder_name = _sanitize_folder_name(name)
    target_folder = target_dir / folder_name
    
    exists = target_folder.exists()
    
    # 如果存在，生成一个建议的唯一名称
    suggested_name = None
    if exists:
        existing_names = {d.name for d in target_dir.iterdir() if d.is_dir()}
        suggested_name = _generate_unique_name(folder_name, existing_names)
    
    return {
        "success": True,
        "exists": exists,
        "folder_name": folder_name,
        "suggested_name": suggested_name,
    }


# ---------- 导出实现 ----------

def _detect_data_type_from_path(folder_path: str) -> Optional[str]:
    """
    从路径自动检测数据类型
    
    Args:
        folder_path: 文件夹路径
        
    Returns:
        数据类型或 None
    """
    path_str = folder_path.replace("\\", "/").lower()
    
    # 特殊处理插件路径
    if "/plugins/" in path_str and "/data/" not in path_str:
        return "plugin"
    
    for type_key, config in DATA_TYPE_CONFIG.items():
        dir_name = config["dir"].lower()
        if f"/data/{dir_name}/" in path_str or f"\\data\\{dir_name}\\" in path_str.replace("/", "\\"):
            return type_key
    
    return None


def export_data_impl(
    folder_path: str,
    data_type: Optional[str] = None,
    embed_image_base64: Optional[str] = None
) -> Dict[str, Any]:
    """
    导出数据的主实现函数
    
    Args:
        folder_path: 要导出的目录路径（相对于仓库根或绝对路径）
        data_type: 数据类型（可选，自动检测）
        embed_image_base64: Base64 编码的嵌入图片（可选，如提供则输出 PNG，否则输出 ZIP）
        
    Returns:
        导出结果，包含 Base64 编码的文件内容
    """
    root = _repo_root()
    
    # 解析路径
    folder = Path(folder_path)
    if not folder.is_absolute():
        folder = root / folder
    folder = folder.resolve()
    
    # 特殊处理：插件类型
    is_plugin = data_type == "plugin"
    
    # 验证路径存在
    if not folder.exists():
        return {
            "success": False,
            "error": "NOT_FOUND",
            "message": f"目录不存在: {folder_path}"
        }
    
    if not folder.is_dir():
        return {
            "success": False,
            "error": "NOT_DIRECTORY",
            "message": f"路径不是目录: {folder_path}"
        }
    
    # 自动检测数据类型
    if not data_type:
        data_type = _detect_data_type_from_path(str(folder))
    
    if not data_type:
        return {
            "success": False,
            "error": "UNKNOWN_TYPE",
            "message": "无法自动检测数据类型，请手动指定 data_type"
        }
    
    # 验证数据类型
    config = DATA_TYPE_CONFIG.get(data_type)
    if not config:
        return {
            "success": False,
            "error": "INVALID_TYPE",
            "message": f"不支持的数据类型: {data_type}"
        }
    
    # 获取数据名称
    data_name = folder.name
    
    # 读取主文件获取名称（如果存在）
    main_file_path = folder / config["main_file"]
    if main_file_path.exists():
        main_data, _ = _safe_read_json(main_file_path)
        if main_data and config["name_field"] in main_data:
            data_name = str(main_data[config["name_field"]])
    
    # 创建元数据
    meta_data = {
        "type": data_type,
        "version": EXPORT_VERSION,
        "created_at": datetime.now().isoformat(),
        "name": data_name,
        "folder_name": folder.name,
    }
    
    # 创建 ZIP 文件
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # 添加元数据文件
        zf.writestr(META_FILENAME, json.dumps(meta_data, ensure_ascii=False, indent=2))
        
        # 添加目录中的所有文件
        for file_path in folder.rglob("*"):
            if file_path.is_file():
                arcname = folder.name + "/" + str(file_path.relative_to(folder))
                zf.write(file_path, arcname)
    
    zip_data = zip_buffer.getvalue()
    
    # 根据是否提供嵌入图片决定输出格式
    if embed_image_base64:
        # 嵌入到 PNG 图片
        try:
            png_data = base64.b64decode(embed_image_base64)
            # 验证是否为有效的 PNG
            if png_data[:8] != b'\x89PNG\r\n\x1a\n':
                return {
                    "success": False,
                    "error": "INVALID_IMAGE",
                    "message": "提供的图片不是有效的 PNG 格式"
                }
        except Exception as e:
            return {
                "success": False,
                "error": "DECODE_FAILED",
                "message": f"图片 Base64 解码失败: {str(e)}"
            }
        
        # 读取 PNG 数据块
        try:
            chunks = _read_png_chunks(png_data)
        except Exception as e:
            return {
                "success": False,
                "error": "PNG_PARSE_FAILED",
                "message": f"PNG 解析失败: {str(e)}"
            }
        
        # 创建嵌入数据
        embed_data = {
            "type": data_type,
            "version": EXPORT_VERSION,
            "created_at": datetime.now().isoformat(),
            "name": data_name,
            "folder_name": folder.name,
            "data": base64.b64encode(zip_data).decode("ascii"),
        }
        
        # 压缩嵌入数据
        embed_json = json.dumps(embed_data, ensure_ascii=False)
        compressed_embed = zlib.compress(embed_json.encode('utf-8'), 9)
        
        # 创建自定义数据块
        custom_chunk = _create_png_chunk(PNG_CHUNK_NAME, compressed_embed)
        
        # 重新组装 PNG（在 IEND 前插入自定义块）
        output_png = png_data[:8]  # PNG 文件头
        
        for chunk_type, chunk_data in chunks:
            if chunk_type == b'IEND':
                # 在 IEND 前插入自定义数据块
                output_png += custom_chunk
            
            # 添加原有数据块
            output_png += _create_png_chunk(chunk_type, chunk_data)
        
        return {
            "success": True,
            "message": f"成功导出 {data_type}: {data_name}",
            "data_type": data_type,
            "name": data_name,
            "format": "png",
            "filename": f"{_sanitize_folder_name(data_name)}.png",
            "content_base64": base64.b64encode(output_png).decode("ascii"),
            "size": len(output_png),
        }
    
    else:
        # 直接返回 ZIP
        return {
            "success": True,
            "message": f"成功导出 {data_type}: {data_name}",
            "data_type": data_type,
            "name": data_name,
            "format": "zip",
            "filename": f"{_sanitize_folder_name(data_name)}.zip",
            "content_base64": base64.b64encode(zip_data).decode("ascii"),
            "size": len(zip_data),
        }