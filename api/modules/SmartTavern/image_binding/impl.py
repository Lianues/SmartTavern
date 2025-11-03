# Image Binding Module
# 实现文件与PNG图片的绑定与提取功能

import os
import json
import struct
import zlib
import base64
import io
import binascii
import shutil
from typing import Dict, List, Tuple, Optional, Union, BinaryIO
from pathlib import Path

from .variables import (
    FILE_TYPE_TAGS, 
    PNG_CHUNK_NAME, 
    MAX_FILE_SIZE,
    BINDING_VERSION,
    DEFAULT_EXPORT_DIR
)

class ImageBindingModule:
    """
    图片文件绑定模块，用于将文件嵌入PNG图片中并从中提取文件
    支持世界书、正则、角色卡、预设、用户配置等文件类型
    """
    
    def __init__(self):
        """初始化图片文件绑定模块"""
        # 确保导出目录存在
        self.export_dir = Path(DEFAULT_EXPORT_DIR)
        self.export_dir.mkdir(exist_ok=True)
    
    @staticmethod
    def _auto_detect_file_type(filename: str, file_content: bytes = None) -> str:
        """
        根据文件名或内容自动检测文件类型标签
        
        Args:
            filename: 文件名
            file_content: 文件内容（可选，用于更准确的类型检测）
            
        Returns:
            文件类型标签
        """
        # 根据文件名后缀和路径判断文件类型
        path = Path(filename.lower())
        filename_lower = path.name.lower()
        
        if "world_book" in str(path) or filename_lower.startswith("world_"):
            return FILE_TYPE_TAGS["WORLD_BOOK"]
        elif "regex" in str(path) or filename_lower.startswith("regex_"):
            return FILE_TYPE_TAGS["REGEX"]
        elif "character" in str(path) or "char" in str(path):
            return FILE_TYPE_TAGS["CHARACTER"]
        elif "preset" in str(path):
            return FILE_TYPE_TAGS["PRESET"]
        elif "personas" in str(path):
            return FILE_TYPE_TAGS["PERSONA"]
        else:
            # 如果基于文件名无法确定类型，尝试根据文件内容判断
            if file_content and filename_lower.endswith('.json'):
                try:
                    import json
                    content = json.loads(file_content.decode('utf-8'))
                    
                    # 检查是否为预设文件
                    if isinstance(content, dict) and "prompts" in content:
                        prompts = content["prompts"]
                        if isinstance(prompts, list) and len(prompts) > 0:
                            # 检查prompts数组中的元素是否有预设特征
                            if all("identifier" in p for p in prompts if isinstance(p, dict)):
                                return FILE_TYPE_TAGS["PRESET"]
                    
                    # 检查是否为角色卡文件
                    if isinstance(content, dict) and "name" in content and "message" in content:
                        return FILE_TYPE_TAGS["CHARACTER"]
                    
                    # 检查是否为世界书文件
                    if isinstance(content, dict) and ("entries" in content or "worldInfo" in content):
                        return FILE_TYPE_TAGS["WORLD_BOOK"]
                    elif isinstance(content, list) and len(content) > 0:
                        # 检查数组格式的世界书
                        first_item = content[0]
                        if isinstance(first_item, list) and len(first_item) > 0:
                            first_item = first_item[0]
                        if isinstance(first_item, dict) and all(field in first_item for field in ["id", "name", "content"]):
                            return FILE_TYPE_TAGS["WORLD_BOOK"]
                    
                    # 检查是否为正则规则文件
                    if isinstance(content, list) and len(content) > 0:
                        first_item = content[0]
                        if isinstance(first_item, dict) and "find_regex" in first_item and "replace_regex" in first_item:
                            return FILE_TYPE_TAGS["REGEX"]
                    
                    # 检查是否为用户信息文件
                    if isinstance(content, dict) and "name" in content and "description" in content and "message" not in content:
                        return FILE_TYPE_TAGS["PERSONA"]
                        
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass
            
            return FILE_TYPE_TAGS["OTHER"]
    
    @staticmethod
    def _read_png_chunks(png_data: bytes) -> List[Tuple[bytes, bytes]]:
        """
        读取PNG图片的所有数据块
        
        Args:
            png_data: PNG图片的二进制数据
            
        Returns:
            数据块列表，每个元素为(chunk_type, chunk_data)元组
        """
        # 检查PNG文件头
        if png_data[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError("无效的PNG文件")
        
        chunks = []
        pos = 8  # 跳过PNG文件头
        
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
            
            # 跳过CRC校验（4字节）
            pos += 4
            
            chunks.append((chunk_type, chunk_data))
            
            # 检查是否为IEND块（PNG文件结束标记）
            if chunk_type == b'IEND':
                break
        
        return chunks
    
    @staticmethod
    def _create_png_chunk(chunk_type: bytes, chunk_data: bytes) -> bytes:
        """
        创建PNG数据块
        
        Args:
            chunk_type: 数据块类型（4字节）
            chunk_data: 数据块内容
            
        Returns:
            完整的PNG数据块二进制数据
        """
        chunk = struct.pack(">I", len(chunk_data))  # 长度（4字节）
        chunk += chunk_type  # 类型（4字节）
        chunk += chunk_data  # 数据
        
        # 计算CRC32校验值
        crc = zlib.crc32(chunk_type + chunk_data) & 0xffffffff
        chunk += struct.pack(">I", crc)  # CRC（4字节）
        
        return chunk
    
    def embed_files_to_image(
        self, 
        image_path: str, 
        file_paths: List[str], 
        output_path: Optional[str] = None
    ) -> str:
        """
        将多个文件嵌入到PNG图片中
        
        Args:
            image_path: PNG图片路径
            file_paths: 要嵌入的文件路径列表
            output_path: 输出图片路径，默认为原图片路径加上_embedded后缀
            
        Returns:
            输出图片路径
        """
        # 读取原PNG图片
        with open(image_path, 'rb') as f:
            png_data = f.read()
        
        # 获取所有数据块
        chunks = self._read_png_chunks(png_data)
        
        # 准备嵌入的文件数据
        files_data = []
        
        for file_path in file_paths:
            # 检查文件大小
            file_size = os.path.getsize(file_path)
            if file_size > MAX_FILE_SIZE:
                raise ValueError(f"文件 {file_path} 太大，超过最大限制 {MAX_FILE_SIZE} 字节")
            
            # 读取文件内容
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            # 自动检测文件类型，传入文件内容以提高检测准确性
            file_type = self._auto_detect_file_type(file_path, file_content)
            
            # 准备文件数据
            file_data = {
                "name": os.path.basename(file_path),
                "type": file_type,
                "content": base64.b64encode(file_content).decode('utf-8'),
                "size": file_size
            }
            
            files_data.append(file_data)
        
        # 创建绑定数据
        binding_data = {
            "version": BINDING_VERSION,
            "timestamp": __import__('datetime').datetime.now().isoformat(),
            "files": files_data
        }
        
        # 将绑定数据转换为JSON并压缩
        binding_json = json.dumps(binding_data, ensure_ascii=False)
        compressed_data = zlib.compress(binding_json.encode('utf-8'))
        
        # 创建自定义数据块
        custom_chunk = self._create_png_chunk(PNG_CHUNK_NAME, compressed_data)
        
        # 在IEND块前插入自定义数据块
        output_data = png_data[:8]  # PNG文件头
        
        for i, (chunk_type, chunk_data) in enumerate(chunks):
            if chunk_type == b'IEND':
                # 在IEND块前插入自定义数据块
                output_data += custom_chunk
            
            # 添加原有数据块
            output_data += self._create_png_chunk(chunk_type, chunk_data)
        
        # 确定输出路径
        if output_path is None:
            base_name, ext = os.path.splitext(image_path)
            output_path = f"{base_name}_embedded{ext}"
        
        # 写入输出图片
        with open(output_path, 'wb') as f:
            f.write(output_data)
        
        return output_path
    
    def extract_files_from_image(
        self, 
        image_path: str, 
        output_dir: Optional[str] = None,
        filter_types: Optional[List[str]] = None
    ) -> List[Dict[str, str]]:
        """
        从PNG图片中提取文件
        
        Args:
            image_path: PNG图片路径
            output_dir: 输出目录，默认为DEFAULT_EXPORT_DIR
            filter_types: 只提取指定类型的文件，默认为None（提取所有类型）
            
        Returns:
            提取的文件信息列表，每个元素为包含文件路径和类型的字典
        """
        # 确定输出目录
        if output_dir is None:
            output_dir = self.export_dir
        else:
            output_dir = Path(output_dir)
            output_dir.mkdir(exist_ok=True)
        
        # 读取PNG图片
        with open(image_path, 'rb') as f:
            png_data = f.read()
        
        # 获取所有数据块
        chunks = self._read_png_chunks(png_data)
        
        # 查找自定义数据块
        binding_data = None
        
        for chunk_type, chunk_data in chunks:
            if chunk_type == PNG_CHUNK_NAME:
                # 解压缩数据
                try:
                    decompressed_data = zlib.decompress(chunk_data)
                    binding_data = json.loads(decompressed_data.decode('utf-8'))
                    break
                except (zlib.error, json.JSONDecodeError) as e:
                    raise ValueError(f"无法解析图片中的绑定数据: {str(e)}")
        
        if binding_data is None:
            raise ValueError("图片中未找到绑定数据")
        
        # 检查版本兼容性
        if binding_data.get("version") != BINDING_VERSION:
            print(f"警告: 绑定数据版本 ({binding_data.get('version')}) 与当前版本 ({BINDING_VERSION}) 不匹配")
        
        # 提取文件
        extracted_files = []
        
        for file_data in binding_data.get("files", []):
            file_type = file_data.get("type")
            
            # 如果指定了过滤类型，则只提取指定类型的文件
            if filter_types and file_type not in filter_types:
                continue
            
            file_name = file_data.get("name")
            file_content_b64 = file_data.get("content")
            
            if not all([file_name, file_content_b64]):
                print(f"警告: 跳过无效的文件数据")
                continue
            
            # 解码文件内容
            try:
                file_content = base64.b64decode(file_content_b64)
            except binascii.Error:
                print(f"警告: 无法解码文件 {file_name} 的内容")
                continue
            
            # 生成输出文件路径
            output_path = output_dir / file_name
            
            # 写入文件
            with open(output_path, 'wb') as f:
                f.write(file_content)
            
            # 记录提取的文件信息
            extracted_files.append({
                "path": str(output_path),
                "type": file_type,
                "name": file_name
            })
        
        return extracted_files
    
    def get_embedded_files_info(self, image_path: str) -> List[Dict]:
        """
        获取PNG图片中嵌入的文件信息（不提取文件内容）
        
        Args:
            image_path: PNG图片路径
            
        Returns:
            嵌入文件的信息列表
        """
        # 读取PNG图片
        with open(image_path, 'rb') as f:
            png_data = f.read()
        
        # 获取所有数据块
        chunks = self._read_png_chunks(png_data)
        
        # 查找自定义数据块
        for chunk_type, chunk_data in chunks:
            if chunk_type == PNG_CHUNK_NAME:
                # 解压缩数据
                try:
                    decompressed_data = zlib.decompress(chunk_data)
                    binding_data = json.loads(decompressed_data.decode('utf-8'))
                    
                    # 构建文件信息（不包含内容）
                    files_info = []
                    for file_data in binding_data.get("files", []):
                        # 移除文件内容，减少返回数据大小
                        file_info = {k: v for k, v in file_data.items() if k != "content"}
                        files_info.append(file_info)
                    
                    return files_info
                except (zlib.error, json.JSONDecodeError) as e:
                    raise ValueError(f"无法解析图片中的绑定数据: {str(e)}")
        
        # 未找到绑定数据
        return []
    
    def is_image_with_embedded_files(self, image_path: str) -> bool:
        """
        检查PNG图片是否包含嵌入的文件
        
        Args:
            image_path: PNG图片路径
            
        Returns:
            是否包含嵌入文件
        """
        try:
            # 读取PNG图片
            with open(image_path, 'rb') as f:
                png_data = f.read()
            
            # 获取所有数据块
            chunks = self._read_png_chunks(png_data)
            
            # 查找自定义数据块
            for chunk_type, _ in chunks:
                if chunk_type == PNG_CHUNK_NAME:
                    return True
            
            return False
        except Exception:
            return False