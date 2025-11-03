"""
图像绑定工作流 - 用于测试和使用图像绑定模块
"""

import os
import json
import base64
from pathlib import Path
from typing import Dict, List, Any, Optional

from modules.SmartTavern.image_binding_module import ImageBindingModule
from modules.SmartTavern.image_binding_module.variables import FILE_TYPE_TAGS

class ImageBindingWorkflow:
    """
    图像绑定工作流，提供将文件嵌入图片和从图片提取文件的功能
    """
    
    def __init__(self):
        """初始化图像绑定工作流"""
        self.image_binding = ImageBindingModule()
        self.shared_dir = Path("shared/SmartTavern")
        
        # 确保导出目录存在
        self.export_dir = self.shared_dir / "exports"
        self.export_dir.mkdir(exist_ok=True)
    
    async def embed_files_to_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        将文件嵌入到图片中
        
        Args:
            data: 包含以下字段的字典：
                - image_path: 图片路径（相对于项目根目录）
                - file_paths: 要嵌入的文件路径列表（相对于项目根目录）
                - output_path: 输出图片路径（可选）
        
        Returns:
            包含处理结果的字典
        """
        try:
            # 获取参数
            image_path = data.get("image_path")
            file_paths = data.get("file_paths", [])
            output_path = data.get("output_path")
            
            if not image_path:
                return {"success": False, "message": "缺少图片路径参数"}
            
            if not file_paths:
                return {"success": False, "message": "缺少文件路径参数"}
            
            # 处理路径
            image_path = str(Path(image_path))
            file_paths = [str(Path(path)) for path in file_paths]
            
            if output_path:
                output_path = str(Path(output_path))
            
            # 执行嵌入操作
            result_path = self.image_binding.embed_files_to_image(
                image_path=image_path,
                file_paths=file_paths,
                output_path=output_path
            )
            
            # 生成相对于共享目录的路径
            rel_path = os.path.relpath(result_path, start=str(self.shared_dir)) if result_path.startswith(str(self.shared_dir)) else result_path
            
            return {
                "success": True,
                "message": f"文件已成功嵌入到图片中",
                "output_path": result_path,
                "relative_path": rel_path
            }
        
        except Exception as e:
            return {"success": False, "message": f"嵌入文件失败: {str(e)}"}
    
    async def extract_files_from_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        从图片中提取文件
        
        Args:
            data: 包含以下字段的字典：
                - image_path: 图片路径（相对于项目根目录）
                - output_dir: 输出目录（可选，默认为shared/SmartTavern/exports）
                - filter_types: 过滤的文件类型列表（可选）
        
        Returns:
            包含处理结果的字典
        """
        try:
            # 获取参数
            image_path = data.get("image_path")
            output_dir = data.get("output_dir")
            filter_types = data.get("filter_types")
            
            if not image_path:
                return {"success": False, "message": "缺少图片路径参数"}
            
            # 处理路径
            image_path = str(Path(image_path))
            
            if output_dir:
                output_dir = str(Path(output_dir))
            else:
                output_dir = str(self.export_dir)
            
            # 执行提取操作
            extracted_files = self.image_binding.extract_files_from_image(
                image_path=image_path,
                output_dir=output_dir,
                filter_types=filter_types
            )
            
            return {
                "success": True,
                "message": f"成功从图片中提取了 {len(extracted_files)} 个文件",
                "files": extracted_files
            }
        
        except Exception as e:
            return {"success": False, "message": f"提取文件失败: {str(e)}"}
    
    async def get_embedded_files_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        获取图片中嵌入的文件信息
        
        Args:
            data: 包含以下字段的字典：
                - image_path: 图片路径（相对于项目根目录）
        
        Returns:
            包含文件信息的字典
        """
        try:
            # 获取参数
            image_path = data.get("image_path")
            
            if not image_path:
                return {"success": False, "message": "缺少图片路径参数"}
            
            # 处理路径
            image_path = str(Path(image_path))
            
            # 获取文件信息
            files_info = self.image_binding.get_embedded_files_info(image_path)
            
            return {
                "success": True,
                "message": f"图片包含 {len(files_info)} 个嵌入文件",
                "files_info": files_info
            }
        
        except Exception as e:
            return {"success": False, "message": f"获取文件信息失败: {str(e)}"}
    
    async def is_image_with_embedded_files(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        检查图片是否包含嵌入文件
        
        Args:
            data: 包含以下字段的字典：
                - image_path: 图片路径（相对于项目根目录）
        
        Returns:
            包含检查结果的字典
        """
        try:
            # 获取参数
            image_path = data.get("image_path")
            
            if not image_path:
                return {"success": False, "message": "缺少图片路径参数"}
            
            # 处理路径
            image_path = str(Path(image_path))
            
            # 检查图片
            has_embedded_files = self.image_binding.is_image_with_embedded_files(image_path)
            
            return {
                "success": True,
                "has_embedded_files": has_embedded_files,
                "message": "图片包含嵌入文件" if has_embedded_files else "图片不包含嵌入文件"
            }
        
        except Exception as e:
            return {"success": False, "message": f"检查图片失败: {str(e)}"}
    
    async def get_file_type_tags(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        获取所有支持的文件类型标签
        
        Returns:
            包含文件类型标签的字典
        """
        try:
            return {
                "success": True,
                "file_type_tags": FILE_TYPE_TAGS
            }
        
        except Exception as e:
            return {"success": False, "message": f"获取文件类型标签失败: {str(e)}"}
    
    async def test_image_binding(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试图像绑定模块的功能
        
        Args:
            data: 包含以下字段的字典：
                - image_path: 测试用图片路径（相对于项目根目录）
                - test_files: 测试用文件路径列表（相对于项目根目录）
        
        Returns:
            包含测试结果的字典
        """
        try:
            # 获取参数
            image_path = data.get("image_path", "shared/SmartTavern/测试图片.png")
            test_files = data.get("test_files", [])
            
            # 如果没有提供测试文件，使用默认的测试文件
            if not test_files:
                test_files = [
                    "shared/SmartTavern/world_books/参考用main_world.json",
                    "shared/SmartTavern/regex_rules/remove_xml_tags.json",
                    "shared/SmartTavern/presets/Default.json",
                    "shared/SmartTavern/user_preferences.json"
                ]
            
            # 处理路径
            image_path = str(Path(image_path))
            test_files = [str(Path(path)) for path in test_files]
            
            # 创建测试输出目录
            test_dir = self.shared_dir / "test_image_binding"
            test_dir.mkdir(exist_ok=True)
            
            # 定义测试输出路径
            test_output_image = str(test_dir / "test_embedded.png")
            test_output_dir = str(test_dir / "extracted")
            Path(test_output_dir).mkdir(exist_ok=True)
            
            # 测试嵌入功能
            embed_result = await self.embed_files_to_image({
                "image_path": image_path,
                "file_paths": test_files,
                "output_path": test_output_image
            })
            
            if not embed_result.get("success"):
                return embed_result
            
            # 测试获取文件信息功能
            info_result = await self.get_embedded_files_info({
                "image_path": test_output_image
            })
            
            if not info_result.get("success"):
                return info_result
            
            # 测试提取功能
            extract_result = await self.extract_files_from_image({
                "image_path": test_output_image,
                "output_dir": test_output_dir
            })
            
            if not extract_result.get("success"):
                return extract_result
            
            # 返回完整的测试结果
            return {
                "success": True,
                "message": "图像绑定模块测试完成",
                "embed_result": embed_result,
                "info_result": info_result,
                "extract_result": extract_result,
                "test_output_image": test_output_image,
                "test_output_dir": test_output_dir
            }
        
        except Exception as e:
            return {"success": False, "message": f"测试失败: {str(e)}"}
