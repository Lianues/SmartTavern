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
    "style": {
        "dir": "styles",
        "main_file": "manifest.json",
        "name_field": "name",
        "register_enabled": True,  # 标记需要注册到 styles_switch.json
        "is_style": True,  # 标记为主题类型
    },
}

# PNG 自定义数据块名称（与 image_binding 模块保持一致）
PNG_CHUNK_NAME = b'stDa'

# 元数据文件名（ZIP 内的标记文件）
META_FILENAME = ".st_meta.json"

# 当前版本
EXPORT_VERSION = "1.0.0"


# 类型名称标识映射（用于从文件名识别类型）
TYPE_IDENTIFIERS = {
    "preset": ["preset", "预设"],
    "character": ["character", "角色", "角色卡"],
    "worldbook": ["worldbook", "world_book", "世界书"],
    "persona": ["persona", "用户", "人设"],
    "regex_rule": ["regex", "正则", "regex_rule"],
    "llm_config": ["llm", "llm_config", "llm配置"],
    "plugin": ["plugin", "插件"],
    "style": ["style", "theme", "主题", "sttheme"],
}

# 类型到导出前缀的映射
TYPE_EXPORT_PREFIX = {
    "preset": "preset",
    "character": "character",
    "worldbook": "worldbook",
    "persona": "persona",
    "regex_rule": "regex",
    "llm_config": "llm_config",
    "plugin": "plugin",
    "style": "style",
}


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


def _styles_root() -> Path:
    """返回主题根目录"""
    return _repo_root() / "backend_projects" / "SmartTavern" / "styles"


def _styles_switch_file() -> Path:
    """返回主题开关配置文件路径"""
    return _styles_root() / "styles_switch.json"


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


def _detect_type_from_filename(filename: str) -> Tuple[Optional[str], Optional[str]]:
    """
    从文件名中检测数据类型，并提取去掉前/后缀后的纯名称
    
    支持两种格式：
    - 前缀格式：preset_xxx.json, character_xxx.json 等
    - 后缀格式：xxx_preset.json, xxx_character.json 等
    
    Args:
        filename: 文件名（不包含路径）
        
    Returns:
        (检测到的数据类型, 去掉前/后缀后的纯名称)
        如果没有检测到则返回 (None, None)
    """
    # 获取不带扩展名的原始文件名（保留大小写）
    original_name_without_ext = Path(filename).stem
    # 转换为小写进行匹配
    name_without_ext_lower = original_name_without_ext.lower()
    
    # 遍历所有类型标识进行匹配
    for data_type, identifiers in TYPE_IDENTIFIERS.items():
        for identifier in identifiers:
            identifier_lower = identifier.lower()
            
            # 检查前缀格式（如 preset_xxx, preset-xxx）
            prefix_patterns = [
                (f"{identifier_lower}_", "_"),
                (f"{identifier_lower}-", "-"),
            ]
            for pattern, sep in prefix_patterns:
                if name_without_ext_lower.startswith(pattern):
                    # 提取去掉前缀后的名称（使用原始大小写）
                    clean_name = original_name_without_ext[len(pattern):]
                    return data_type, clean_name
            
            # 检查后缀格式（如 xxx_preset, xxx-preset）
            suffix_patterns = [
                (f"_{identifier_lower}", "_"),
                (f"-{identifier_lower}", "-"),
            ]
            for pattern, sep in suffix_patterns:
                if name_without_ext_lower.endswith(pattern):
                    # 提取去掉后缀后的名称（使用原始大小写）
                    clean_name = original_name_without_ext[:-len(pattern)]
                    return data_type, clean_name
            
            # 也检查文件名中是否包含类型标识（被 _ 或 - 包围）
            # 这种情况不提取名称，保留原文件名
            infix_patterns = [
                f"_{identifier_lower}_",
                f"-{identifier_lower}-",
                f"_{identifier_lower}-",
                f"-{identifier_lower}_",
            ]
            for pattern in infix_patterns:
                if pattern in name_without_ext_lower:
                    return data_type, original_name_without_ext
    
    return None, None


def _validate_json_file_type(filename: str, expected_type: str) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """
    验证 JSON 文件名是否包含正确的类型标识
    
    Args:
        filename: 文件名
        expected_type: 期望的数据类型
        
    Returns:
        (是否有效, 错误码, 检测到的类型, 去掉前/后缀后的纯名称)
    """
    detected_type, clean_name = _detect_type_from_filename(filename)
    
    if detected_type is None:
        # 文件名中没有类型标识
        return False, "NO_TYPE_IN_FILENAME", None, None
    
    if detected_type != expected_type:
        # 类型不匹配
        return False, "TYPE_MISMATCH", detected_type, None
    
    return True, None, detected_type, clean_name


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


def _register_style_enabled(style_name: str) -> Optional[str]:
    """
    将主题添加到 styles_switch.json 的 enabled 列表中，并更新 order 字段
    
    Args:
        style_name: 主题文件夹名称
        
    Returns:
        错误信息，成功返回 None
    """
    switch_file = _styles_switch_file()
    
    try:
        # 读取现有配置
        if switch_file.exists():
            with switch_file.open("r", encoding="utf-8") as f:
                switch_data = json.load(f)
        else:
            switch_data = {"enabled": [], "disabled": [], "order": []}
        
        # 确保 enabled、disabled 和 order 列表存在
        if "enabled" not in switch_data:
            switch_data["enabled"] = []
        if "disabled" not in switch_data:
            switch_data["disabled"] = []
        if "order" not in switch_data:
            switch_data["order"] = []
        
        # 如果主题不在 enabled 列表中，添加它
        if style_name not in switch_data["enabled"]:
            switch_data["enabled"].append(style_name)
        
        # 如果主题在 disabled 列表中，移除它
        if style_name in switch_data["disabled"]:
            switch_data["disabled"].remove(style_name)
        
        # 如果主题不在 order 列表中，添加到末尾
        if style_name not in switch_data["order"]:
            switch_data["order"].append(style_name)
        
        # 写回配置文件
        switch_file.parent.mkdir(parents=True, exist_ok=True)
        with switch_file.open("w", encoding="utf-8") as f:
            json.dump(switch_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        
        return None
    except Exception as e:
        return f"注册主题失败: {type(e).__name__}: {e}"


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

def _extract_data_from_zip(zip_data: bytes, data_type: str, validate_type: bool = True) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, bytes]], Optional[str], Optional[str], Optional[Dict[str, Any]]]:
    """
    从 ZIP 压缩包中提取数据
    
    Args:
        zip_data: ZIP 文件的二进制数据
        data_type: 数据类型
        validate_type: 是否验证类型匹配
        
    Returns:
        (主 JSON 数据, 附加文件字典, 错误信息, 错误码, 额外信息)
        错误码: TYPE_MISMATCH / NO_TYPE_INFO / 其他
        额外信息: 包含 expected_type, actual_type, folder_name 等
    """
    try:
        config = DATA_TYPE_CONFIG.get(data_type)
        if not config:
            return None, None, f"不支持的数据类型: {data_type}", "INVALID_TYPE", None
        
        main_file = config["main_file"]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # 解压 ZIP 文件
            with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zf:
                zf.extractall(temp_path)
            
            # 检查元数据文件
            meta_path = temp_path / META_FILENAME
            embedded_type = None
            embedded_folder_name = None
            meta_found = False
            meta_data = None
            
            if meta_path.exists():
                meta_found = True
                meta_data, _ = _safe_read_json(meta_path)
                if meta_data:
                    embedded_type = meta_data.get("type")
                    embedded_folder_name = meta_data.get("folder_name")
            else:
                # 也检查子目录中是否有元数据文件
                for item in temp_path.iterdir():
                    if item.is_dir():
                        sub_meta = item / META_FILENAME
                        if sub_meta.exists():
                            meta_found = True
                            meta_data, _ = _safe_read_json(sub_meta)
                            if meta_data:
                                embedded_type = meta_data.get("type")
                                embedded_folder_name = meta_data.get("folder_name")
                            break
            
            # 如果启用类型验证，必须存在元数据文件
            if validate_type:
                if not meta_found:
                    extra_info = {"expected_type": data_type}
                    return None, None, f"ZIP 中未找到类型标记文件 ({META_FILENAME})，无法验证文件类型。此文件可能不是从本系统导出的。", "NO_TYPE_INFO", extra_info
                
                if not embedded_type:
                    extra_info = {"expected_type": data_type}
                    return None, None, f"类型标记文件 ({META_FILENAME}) 中缺少 type 字段，无法验证文件类型", "NO_TYPE_INFO", extra_info
                
                if embedded_type != data_type:
                    extra_info = {
                        "expected_type": data_type,
                        "actual_type": embedded_type
                    }
                    return None, None, f"文件类型不匹配：文件包含 {embedded_type} 类型的数据，但当前面板期望 {data_type} 类型", "TYPE_MISMATCH", extra_info
                
                # 必须有 folder_name
                if not embedded_folder_name:
                    extra_info = {"expected_type": data_type}
                    return None, None, f"类型标记文件 ({META_FILENAME}) 中缺少 folder_name 字段，无法确定文件夹名称", "NO_FOLDER_NAME", extra_info
            
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
                return None, None, f"ZIP 中未找到 {main_file} 或任何 JSON 文件", "NO_MAIN_FILE", None
            
            # 读取主 JSON 文件
            main_data, err = _safe_read_json(main_json_path)
            if err:
                return None, None, f"读取 JSON 失败: {err}", "PARSE_FAILED", None
            
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
            
            # 返回额外信息包含 folder_name
            result_info = {"folder_name": embedded_folder_name} if embedded_folder_name else None
            return main_data, extra_files, None, None, result_info
            
    except zipfile.BadZipFile:
        return None, None, "无效的 ZIP 文件", "INVALID_ZIP", None
    except Exception as e:
        return None, None, f"解压 ZIP 失败: {type(e).__name__}: {e}", "EXTRACT_FAILED", None


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
    
    # 特殊处理：插件/主题类型使用不同的根目录
    is_plugin = data_type == "plugin"
    is_style = data_type == "style"
    
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
    # 用于存储从文件名提取的清理后的名称（仅 JSON 导入时使用）
    clean_name_from_filename = None
    # 用于存储从 ZIP/PNG 的 .st_meta.json 中提取的 folder_name
    folder_name_from_meta = None
    
    if file_type == 'json':
        # 对于 JSON 文件，检查文件名是否包含类型标识
        is_valid, err_code, detected_type, clean_name_from_filename = _validate_json_file_type(filename, data_type)
        if not is_valid:
            if err_code == "NO_TYPE_IN_FILENAME":
                return {
                    "success": False,
                    "error": "NO_TYPE_IN_FILENAME",
                    "message": f"JSON 文件名 '{filename}' 中未包含类型标识。请确保文件名包含类型前缀或后缀，如 '{TYPE_EXPORT_PREFIX.get(data_type, data_type)}_名称.json' 或 '名称_{TYPE_EXPORT_PREFIX.get(data_type, data_type)}.json'",
                    "expected_type": data_type
                }
            elif err_code == "TYPE_MISMATCH":
                return {
                    "success": False,
                    "error": "TYPE_MISMATCH",
                    "message": f"文件类型不匹配：文件名表明这是 {detected_type} 类型的数据，但当前面板期望 {data_type} 类型",
                    "expected_type": data_type,
                    "actual_type": detected_type
                }
        
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
        main_data, extra_files, err, err_code, extra_info = _extract_data_from_zip(file_data, data_type, validate_type=True)
        if err:
            result = {
                "success": False,
                "error": err_code or "EXTRACT_FAILED",
                "message": err
            }
            # 添加额外的类型信息（用于前端显示）
            if extra_info:
                result.update(extra_info)
            return result
        extra_files = extra_files or {}
        # 提取 folder_name
        if extra_info and "folder_name" in extra_info:
            folder_name_from_meta = extra_info["folder_name"]
    
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
                embedded_type = binding_data.get("type")
                
                # 检查嵌入的类型标记
                if not embedded_type:
                    return {
                        "success": False,
                        "error": "NO_TYPE_INFO",
                        "message": "PNG 嵌入数据中缺少类型标记，无法验证文件类型。此文件可能不是从本系统导出的。",
                        "expected_type": data_type
                    }
                
                # 如果嵌入的类型与请求的类型不匹配，返回错误
                if embedded_type != data_type:
                    return {
                        "success": False,
                        "error": "TYPE_MISMATCH",
                        "message": f"文件类型不匹配：文件包含 {embedded_type} 类型的数据，但当前面板期望 {data_type} 类型",
                        "expected_type": data_type,
                        "actual_type": embedded_type
                    }
                
                # ZIP 内部不需要再验证类型（已在外层验证）
                main_data, extra_files, err, err_code, extra_info = _extract_data_from_zip(zip_data, data_type, validate_type=False)
                if err:
                    result = {
                        "success": False,
                        "error": err_code or "EXTRACT_FAILED",
                        "message": err
                    }
                    if extra_info:
                        result.update(extra_info)
                    return result
                extra_files = extra_files or {}
                
                # 从 PNG 嵌入数据的 binding_data 中获取 folder_name
                folder_name_from_meta = binding_data.get("folder_name")
                if not folder_name_from_meta:
                    return {
                        "success": False,
                        "error": "NO_FOLDER_NAME",
                        "message": "PNG 嵌入数据中缺少 folder_name 字段，无法确定文件夹名称",
                        "expected_type": data_type
                    }
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
    
    # 确定文件夹名称
    # 优先级：target_name > 从文件中提取的名称
    folder_name = None
    
    if target_name:
        # 如果用户指定了目标名称，优先使用它（用于重命名场景）
        folder_name = _sanitize_folder_name(target_name)
    elif file_type == 'json':
        # JSON 导入：必须使用去掉前/后缀的文件名
        if not clean_name_from_filename:
            return {
                "success": False,
                "error": "NO_FOLDER_NAME",
                "message": "无法从 JSON 文件名中提取名称，请确保文件名包含正确的类型前缀或后缀",
                "expected_type": data_type
            }
        folder_name = _sanitize_folder_name(clean_name_from_filename)
    else:
        # ZIP/PNG 导入：必须使用 .st_meta.json 中的 folder_name
        if not folder_name_from_meta:
            return {
                "success": False,
                "error": "NO_FOLDER_NAME",
                "message": f"导入文件中缺少 folder_name 字段，无法确定文件夹名称",
                "expected_type": data_type
            }
        folder_name = _sanitize_folder_name(folder_name_from_meta)
    
    # 获取目标目录（插件/主题使用单独的目录）
    if is_plugin:
        target_dir = _plugins_root()
    elif is_style:
        target_dir = _styles_root()
    else:
        target_dir = data_root / config["dir"]
    target_folder = target_dir / folder_name
    
    # 检查是否已存在
    if target_folder.exists():
        if not overwrite:
            # 返回名称冲突错误，让前端处理
            existing_names = {d.name for d in target_dir.iterdir() if d.is_dir()}
            suggested_name = _generate_unique_name(folder_name, existing_names)
            return {
                "success": False,
                "error": "NAME_EXISTS",
                "message": f"名称 '{folder_name}' 已存在，请选择覆盖或重命名",
                "folder_name": folder_name,
                "suggested_name": suggested_name,
                "expected_type": data_type
            }
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
    
    # 特殊处理：插件/主题导入后自动注册到 enabled 列表
    register_error = None
    if is_plugin and config.get("register_enabled"):
        register_error = _register_plugin_enabled(folder_name)
    elif is_style and config.get("register_enabled"):
        register_error = _register_style_enabled(folder_name)
    
    # 确定显示名称（从数据中获取或使用文件夹名）
    name_field = config["name_field"]
    display_name = folder_name
    if isinstance(main_data, dict) and name_field in main_data:
        display_name = str(main_data[name_field])
    
    # 返回结果
    result = {
        "success": True,
        "message": f"成功导入 {data_type}",
        "data_type": data_type,
        "name": display_name,
        "folder": folder_name,
        "file": _path_rel_to_root(main_file_path, root),
        "extra_files": list(extra_files.keys()),
    }
    
    # 如果是插件或主题，添加注册结果
    if is_plugin or is_style:
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
    
    # 插件/主题使用单独的目录
    if data_type == "plugin":
        target_dir = _plugins_root()
    elif data_type == "style":
        target_dir = _styles_root()
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
    
    # 特殊处理主题路径
    if "/styles/" in path_str and "/data/" not in path_str:
        return "style"
    
    for type_key, config in DATA_TYPE_CONFIG.items():
        dir_name = config["dir"].lower()
        if f"/data/{dir_name}/" in path_str or f"\\data\\{dir_name}\\" in path_str.replace("/", "\\"):
            return type_key
    
    return None


def export_data_impl(
    folder_path: str,
    data_type: Optional[str] = None,
    embed_image_base64: Optional[str] = None,
    export_format: Optional[str] = None
) -> Dict[str, Any]:
    """
    导出数据的主实现函数
    
    Args:
        folder_path: 要导出的目录路径（相对于仓库根或绝对路径）
        data_type: 数据类型（可选，自动检测）
        embed_image_base64: Base64 编码的嵌入图片（可选，如提供则输出 PNG，否则输出 ZIP）
        export_format: 导出格式（可选：'zip', 'png', 'json'，默认根据 embed_image_base64 决定）
        
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
    
    # 生成文件名（类型_名称格式）
    type_prefix = TYPE_EXPORT_PREFIX.get(data_type, data_type)
    safe_name = _sanitize_folder_name(data_name)
    
    # 确定最终导出格式
    final_format = export_format
    if not final_format:
        if embed_image_base64:
            final_format = 'png'
        else:
            final_format = 'zip'
    
    # 导出为 JSON 格式
    if final_format == 'json':
        # 读取主文件内容
        if not main_file_path.exists():
            return {
                "success": False,
                "error": "NO_MAIN_FILE",
                "message": f"主文件不存在: {config['main_file']}"
            }
        
        main_data, err = _safe_read_json(main_file_path)
        if err:
            return {
                "success": False,
                "error": "READ_FAILED",
                "message": f"读取文件失败: {err}"
            }
        
        # 将数据转换为 JSON 字符串
        json_content = json.dumps(main_data, ensure_ascii=False, indent=2)
        json_bytes = json_content.encode('utf-8')
        
        return {
            "success": True,
            "message": f"成功导出 {data_type}: {data_name}",
            "data_type": data_type,
            "name": data_name,
            "format": "json",
            "filename": f"{type_prefix}_{safe_name}.json",
            "content_base64": base64.b64encode(json_bytes).decode("ascii"),
            "size": len(json_bytes),
        }
    
    # 创建元数据（不含 version 字段）
    meta_data = {
        "type": data_type,
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
    
    # 导出为 PNG 格式（嵌入到图片）
    if final_format == 'png':
        png_data = None
        
        # 如果提供了嵌入图片，使用它
        if embed_image_base64:
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
        else:
            # 没有提供嵌入图片，尝试从目录中读取 icon.png
            icon_candidates = ['icon.png', 'icon.PNG', 'Icon.png', 'ICON.png']
            for icon_name in icon_candidates:
                icon_path = folder / icon_name
                if icon_path.exists() and icon_path.is_file():
                    try:
                        png_data = icon_path.read_bytes()
                        # 验证是否为有效的 PNG
                        if png_data[:8] == b'\x89PNG\r\n\x1a\n':
                            break
                        else:
                            png_data = None
                    except Exception:
                        png_data = None
            
            # 如果没有找到有效的 icon.png，返回错误
            if not png_data:
                return {
                    "success": False,
                    "error": "NO_ICON_IMAGE",
                    "message": "选择了 PNG 格式但未提供嵌入图片，且目录中没有可用的 icon.png 文件。请选择一张 PNG 图片或使用其他导出格式。"
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
        
        # 创建嵌入数据（不含 version 字段）
        embed_data = {
            "type": data_type,
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
            "filename": f"{safe_name}.png",
            "content_base64": base64.b64encode(output_png).decode("ascii"),
            "size": len(output_png),
        }
    
    else:
        # 直接返回 ZIP（不添加类型前缀，因为 ZIP 内有 .st_meta.json 标记类型）
        return {
            "success": True,
            "message": f"成功导出 {data_type}: {data_name}",
            "data_type": data_type,
            "name": data_name,
            "format": "zip",
            "filename": f"{safe_name}.zip",
            "content_base64": base64.b64encode(zip_data).decode("ascii"),
            "size": len(zip_data),
        }