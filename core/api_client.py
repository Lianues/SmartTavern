"""
轻量级 API 客户端
- 统一通过 HTTP 调用后端注册的 API（@register_api）
- 默认直连本机 API 网关: http://localhost:8050
- 路由规范：根据注册来源自动在路径中添加 '/modules' 或 '/workflow'
  • api/modules/* => /api/modules/...
  • api/workflow/* => /api/workflow/...
- 客户端支持 namespace 参数选择路径前缀；若不指定，将按顺序尝试 modules -> workflow

用法示例:
    from core.api_client import ApiClient, call_api

    # 直接使用全局客户端（使用斜杠路径）
    resp = call_api("web_server/restart_project", {"project_name": "ProjectManager"})  # 自动尝试 /modules 和 /workflow
    print(resp)

    # 指定命名空间
    resp = call_api("image_binding/embed_files_to_image", {"image_path": "...", "file_paths": [...]}, namespace="workflow")

    # 或者自定义客户端实例
    client = ApiClient(base_url="http://127.0.0.1:8050", api_prefix="/api", timeout=15)
    resp = client.call("project_manager/get_status", {"project_name": "ProjectManager"}, method="GET", namespace="modules")
"""

from typing import Any, Dict, Optional, Union, Tuple, List
import os
import inspect
import asyncio
import requests
from urllib.parse import urljoin
from core.config.api_config import get_api_config


class ApiClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_prefix: Optional[str] = None,
        timeout: Union[int, float] = 15,
        default_headers: Optional[Dict[str, str]] = None,
    ):
        """
        初始化 API 客户端
        """
        cfg = get_api_config()
        self.base_url = (base_url or cfg.base_url).rstrip("/")
        _prefix = (api_prefix or cfg.api_prefix)
        self.api_prefix = _prefix if _prefix.startswith("/") else f"/{_prefix}"
        self.timeout = timeout
        self.session = requests.Session()
        self.default_headers = default_headers or {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def set_auth(self, token: Optional[str]) -> None:
        """
        设置鉴权头（Bearer Token）
        """
        if token:
            self.default_headers["Authorization"] = f"Bearer {token}"
        else:
            self.default_headers.pop("Authorization", None)

    def _paths_for(self, name: str, namespace: Optional[str]) -> List[str]:
        """
        根据斜杠路径与命名空间生成可能的请求路径
        - name 必须为斜杠风格（不含点号与反斜杠）
        - namespace 可为 'modules' | 'workflow' | 'plugins' | None；当为 None 时，按 modules -> workflow -> plugins 顺序尝试
        """
        name_path = name.lstrip("/")
        if "." in name_path or "\\" in name_path:
            raise ValueError(f"API name must be a slash-separated path, got: {name}")

        if namespace is None:
            return [
                f"{self.api_prefix}/modules/{name_path}",
                f"{self.api_prefix}/workflow/{name_path}",
                f"{self.api_prefix}/plugins/{name_path}",
            ]
        ns = namespace.strip("/").lower()
        if ns not in ("modules", "workflow", "plugins"):
            # 非法 namespace 时仍按自动策略尝试
            return [
                f"{self.api_prefix}/modules/{name_path}",
                f"{self.api_prefix}/workflow/{name_path}",
                f"{self.api_prefix}/plugins/{name_path}",
            ]
        return [f"{self.api_prefix}/{ns}/{name_path}"]

    def _merge_headers(self, headers: Optional[Dict[str, str]]) -> Dict[str, str]:
        h = dict(self.default_headers or {})
        if headers:
            h.update(headers)
        return h

    def request(
        self,
        method: str,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Tuple[int, Any]:
        """
        统一请求入口，返回 (status_code, parsed_body)
        优先解析为 JSON，不可解析时返回文本
        """
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        h = self._merge_headers(headers)
        try:
            if files:
                # 使用 multipart/form-data；移除 JSON Content-Type
                h.pop("Content-Type", None)
                resp = self.session.request(
                    method.upper(), url, params=params, files=files, data=json, headers=h, timeout=self.timeout
                )
            else:
                resp = self.session.request(
                    method.upper(), url, params=params, json=json, headers=h, timeout=self.timeout
                )
        except requests.RequestException as e:
            return 0, {"error_code": "NETWORK_ERROR", "message": str(e)}

        status = resp.status_code
        body: Any
        try:
            body = resp.json()
        except ValueError:
            body = resp.text

        # 标准化错误输出
        if status >= 400:
            if isinstance(body, dict):
                body.setdefault("error_code", "HTTP_ERROR")
                body.setdefault("status", status)
            else:
                body = {"error_code": "HTTP_ERROR", "status": status, "message": str(body)}
        return status, body

    def call(
        self,
        name: str,
        payload: Optional[Dict[str, Any]] = None,
        method: str = "POST",
        headers: Optional[Dict[str, str]] = None,
        files: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None,
    ) -> Any:
        """
        通过函数名调用 API
        - namespace: 'modules' | 'workflow' | None(自动尝试)
        """
        # 优先尝试“进程内直调”（可配置），避免本机 HTTP 往返
        if method.upper() == "POST":
            inproc = self._call_inproc_if_allowed(name=name, payload=payload, namespace=namespace)
            if inproc is not _Sentinel:
                return inproc

        paths = self._paths_for(name, namespace)
        last_status = None
        last_body = None
        for path in paths:
            if method.upper() == "GET":
                status, body = self.request("GET", path, params=payload, headers=headers)
            else:
                status, body = self.request("POST", path, json=payload, headers=headers, files=files)
            # 成功，或非 404 错误则直接返回
            if status and status < 400:
                return body
            last_status, last_body = status, body
            # 仅在 404 时尝试下一个命名空间
            if status != 404:
                break
        return last_body

    def call_get(
        self,
        name: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        namespace: Optional[str] = None,
    ) -> Any:
        paths = self._paths_for(name, namespace)
        last_status = None
        last_body = None
        for path in paths:
            status, body = self.request("GET", path, params=params, headers=headers)
            if status and status < 400:
                return body
            last_status, last_body = status, body
            if status != 404:
                break
        return last_body

    def call_post(
        self,
        name: str,
        payload: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        files: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None,
    ) -> Any:
        # 优先尝试“进程内直调”（可配置），避免本机 HTTP 往返
        inproc = self._call_inproc_if_allowed(name=name, payload=payload, namespace=namespace)
        if inproc is not _Sentinel:
            return inproc

        paths = self._paths_for(name, namespace)
        last_status = None
        last_body = None
        for path in paths:
            status, body = self.request("POST", path, json=payload, headers=headers, files=files)
            if status and status < 400:
                return body
            last_status, last_body = status, body
            if status != 404:
                break
        return last_body

    # ---------------- In-Process Short-Circuit ----------------
    def _inproc_enabled(self) -> bool:
        # 显式控制：设置 MF_INPROC=1 开启（默认不开启以保持兼容）
        val = os.getenv("MF_INPROC", "0").strip().lower()
        return val in ("1", "true", "yes", "on")

    def _inproc_ns_allowed(self, ns: Optional[str]) -> bool:
        allowed = os.getenv("MF_INPROC_NS", "modules").strip().lower().split(",")
        allowed = [s.strip() for s in allowed if s.strip()]
        if not allowed:
            return False
        n = (ns or "").strip().lower()
        return (n in allowed) or (not n and ("modules" in allowed))

    def _call_inproc_if_allowed(self, name: str, payload: Optional[Dict[str, Any]], namespace: Optional[str]) -> Any:
        """若允许，直接通过注册中心进程内调用；否则返回 _Sentinel 表示走 HTTP。"""
        try:
            if not self._inproc_enabled():
                return _Sentinel
            from core.api_registry import get_registry
            reg = get_registry()
            path_key = name.lstrip("/")
            spec = reg.get_spec(path_key)
            if not spec:
                return _Sentinel
            # 仅允许指定命名空间（默认仅 modules）
            target_ns = spec.namespace
            if not self._inproc_ns_allowed(namespace or target_ns):
                return _Sentinel

            func = reg.functions.get(path_key)
            if not func:
                return _Sentinel

            kwargs = dict(payload or {})
            if inspect.iscoroutinefunction(func):
                # 避免在事件循环线程里阻塞；优先在无循环环境执行
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    return asyncio.run(func(**kwargs))  # type: ignore[misc]
                # 有循环：提交到当前循环外同步等待（不建议用于热点，尽量只启用 modules 同步 API）
                fut = asyncio.run_coroutine_threadsafe(func(**kwargs), loop)  # type: ignore[misc]
                return fut.result()
            else:
                return func(**kwargs)
        except Exception:
            # 任何异常回退到 HTTP，以确保兼容性
            return _Sentinel


class _SentinelClass:
    pass


_Sentinel = _SentinelClass()



# 全局默认客户端
_default_client: Optional[ApiClient] = None

def get_client(
    base_url: Optional[str] = None,
    api_prefix: Optional[str] = None,
    timeout: Optional[Union[int, float]] = None,
) -> ApiClient:
    """
    获取或创建全局默认客户端
    """
    global _default_client
    if _default_client is None:
        cfg = get_api_config()
        _default_client = ApiClient(
            base_url=base_url or cfg.base_url,
            api_prefix=api_prefix or cfg.api_prefix,
            timeout=timeout or 15,
        )
    return _default_client

def call_api(
    name: str,
    payload: Optional[Dict[str, Any]] = None,
    method: str = "POST",
    headers: Optional[Dict[str, str]] = None,
    files: Optional[Dict[str, Any]] = None,
    namespace: Optional[str] = None,
) -> Any:
    """
    使用全局客户端按函数名调用 API
    - namespace: 'modules' | 'workflow' | None(自动)
    """
    client = get_client()
    return client.call(name, payload=payload, method=method, headers=headers, files=files, namespace=namespace)


if __name__ == "__main__":
    # 简单的自检：健康检查
    client = get_client()
    status, body = client.request("GET", "/api/health")
    print("health:", status, body)
    # 示例调用（若注册了对应 API）
    try:
        print(call_api("api_gateway/info", method="GET", namespace="modules"))
    except Exception as e:
        print("call failed:", e)