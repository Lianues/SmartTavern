# 模块：通用 LLM（llm_api）

位置：api/modules/llm_api/

本模块提供“跨厂商统一对话接口”，支持 OpenAI / Anthropic / Google Gemini / OpenAI 兼容端点等，遵循统一“斜杠 path + JSON Schema”规范，通过 core 门面对外暴露 API。已内置 SSE（Server-Sent Events）支持，可按 `stream` 参数选择 JSON 一次性返回或流式返回。

相关代码
- 封装与注册（对外 API 定义/Schemas）：[filename](api/modules/llm_api/llm_api.py)
- 实现层（构建 manager 并执行流式/非流式调用）：[filename](api/modules/llm_api/impl.py)
- 管理器已合并进实现层：[filename](api/modules/llm_api/impl.py)
- 静态变量映射（默认模型/错误映射/常量）：[filename](api/modules/llm_api/variables.py)
- 统一规范参考： [filename](DEVELOPMENT_NOTES.md)

模块功能
- 统一聊天补全：单一 API 支持多厂商，自动适配请求体与解析响应
- 流式输出（SSE）：当 `stream=true` 时，以 `text/event-stream` 逐块推送模型增量文本
- 模型清单：按提供商列出可用模型
- 默认信息：返回支持的提供商、默认模型映射、错误码说明、默认超时等
- 健康检查：快速检测模块可用性

依赖与运行
- SSE 依赖 FastAPI/Starlette 的 StreamingResponse 能力，随框架默认安装（见 core 层网关）
- API 网关自动注册并暴露路径（见开发文档“自动发现与注册”）

API 一览与 I/O 说明

1) llm_api/chat（统一聊天接口，支持 SSE）
- 路径：/api/modules/llm_api/chat
- 方法：GET / POST（建议 POST；SSE 建议使用 POST + fetch 流式读取）
- 输入（JSON）：
  - provider: string，枚举 openai | anthropic | gemini | openai_compatible | custom
  - api_key: string（厂商密钥）
  - base_url: string（例如 OpenAI: https://api.openai.com/v1；Gemini: https://generativelanguage.googleapis.com/v1beta）
  - messages: array of {role, content}；role ∈ ["system","user","assistant"]
  - stream?: boolean（默认 false；true 时返回 text/event-stream）
  - model?: string（不传则使用默认模型映射的首个）
  - max_tokens?: integer（默认 2048）
  - temperature?: number（默认 0.7）
  - top_p?: number
  - presence_penalty?: number
  - frequency_penalty?: number
  - custom_params?: object（透传厂商私有参数；如 Gemini responseMimeType/stopSequences）
  - safety_settings?: object（Gemini 安全策略）
  - timeout?: integer（请求超时）
  - connect_timeout?: integer（连接超时）
  - enable_logging?: boolean（调试日志）
  - models?: string[]（备用模型清单；未传则使用默认映射）
- 输出（两种形态）：
  - 非流式（stream=false；JSON 一次性返回）
    - success: boolean
    - content: string（完整文本）
    - usage?: object {prompt_tokens, completion_tokens, total_tokens}
    - response_time?: number
    - model_used?: string
    - finish_reason?: string
    - raw_response?: object（原始响应）
    - provider?: string
    - error?: string（失败时）
  - 流式（stream=true；text/event-stream）
    - 逐条事件（每条以 `data: {json}\n\n` 推送）：
      - {"type":"chunk","content":"..."}（增量文本片段，可多次）
      - {"type":"finish","finish_reason":"end_turn" | "..."}（可选）
      - {"type":"usage","usage":{...}}（通常结尾一次）
      - {"type":"end"}（流结束）
      - {"type":"error","message":"..."}（发生错误）
- 调用示例（非流式 JSON）：
  ```bash
  curl -X POST "http://localhost:8050/api/modules/llm_api/chat" \
    -H "Content-Type: application/json" \
    -d '{
      "provider":"openai",
      "api_key":"sk-...",
      "base_url":"https://api.openai.com/v1",
      "messages":[
        {"role":"system","content":"你是一个AI助手"},
        {"role":"user","content":"你好"}
      ],
      "model":"gpt-4o-mini",
      "stream":false
    }'
  ```
- 调用示例（SSE 流式；建议使用 fetch/ReadableStream）：
  ```javascript
  // 注意：EventSource 不支持 POST；此处以 fetch 流式读取 SSE（POST）
  const resp = await fetch("http://localhost:8050/api/modules/llm_api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({
      provider: "anthropic",
      api_key: "sk-ant-...",
      base_url: "https://api.anthropic.com/v1",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" }
      ],
      model: "claude-3-5-haiku-20241022",
      stream: true
    })
  });

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // 按 SSE 帧拆分
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      const jsonText = part.slice(6);
      const evt = JSON.parse(jsonText);
      if (evt.type === "chunk") {
        // 增量文本
        console.log(evt.content);
      } else if (evt.type === "finish") {
        console.log("finish:", evt.finish_reason);
      } else if (evt.type === "usage") {
        console.log("usage:", evt.usage);
      } else if (evt.type === "end") {
        console.log("stream end");
      } else if (evt.type === "error") {
        console.error("error:", evt.message);
      }
    }
  }
  ```

说明
- 由于标准 EventSource 仅支持 GET，本模块以 POST + StreamingResponse 提供 SSE；前端需使用 fetch 流式读取
- 若必须使用 EventSource，可将 messages 等复杂参数编码为字符串置于查询参数（GET），但需自行在客户端编码/服务端解析（当前实现未对 GET 查询参数的 JSON 反序列化做特殊处理）

2) llm_api/list_models（列出可用模型）
- 路径：/api/modules/llm_api/list_models
- 方法：GET / POST
- 输入（JSON/Query）：
  - provider: string（同上）
  - api_key: string
  - base_url?: string（Gemini 可不填；OpenAI 兼容/自建需填）
  - limit?: integer
  - page_token?: string
  - before_id?/after_id?: string（Anthropic 分页）
  - timeout?/connect_timeout?/enable_logging?
- 输出（JSON；原样透传关键数据，字段随厂商不同）：
  - success: boolean
  - provider: string
  - models | data: array
  - next_page_token? / has_more? / first_id? / last_id?
  - raw_response?: object
  - error?: string

调用示例
```python
import core
res = core.call_api("llm_api/list_models", {
  "provider":"gemini",
  "api_key":"AIza-..."
}, method="GET", namespace="modules")
```

3) llm_api/get_defaults（获取默认信息）
- 路径：/api/modules/llm_api/get_defaults
- 方法：GET
- 输入：{}
- 输出（JSON）：
  - providers: string[]
  - default_models: object 映射
  - http_error_messages: object
  - defaults: { timeout, connect_timeout, max_request_size, log_level }

4) llm_api/health（健康检查）
- 路径：/api/modules/llm_api/health
- 方法：GET
- 输入：{}
- 输出（JSON）：{ status: "ok", timestamp: number }

最佳实践
- 密钥安全：不要在前端暴露密钥；由后端安全持有并代理调用
- 错误治理：利用返回的 error 或 HTTP 标准码，结合前端 UI 明确提示（如过载/限流）
- SSE 消费：优先使用 fetch 流式读取；确保前端禁用缓存，并在 UI 上逐块渲染
- 连接超时：合理设置 timeout/connect_timeout，避免卡死
- 统一调用：所有跨模块调用统一通过 core 门面（见开发文档）

错误与边界
- HTTP 非 2xx 将映射为 {success:false, error, status_code?}；具体消息见 http_error_messages 映射
- SSE 输出为文本分帧，客户端需按 `\n\n` 拆帧并解析 `data: {json}`
- 部分厂商流式事件的“使用统计”仅在末尾返回
- 流式读取为阻塞 IO，当前实现基于 requests 的迭代；高并发场景建议在网关层加限流

版本与变更
- 初版：统一聊天（JSON/SSE）、模型清单、默认信息与健康检查；全面遵循 DEVELOPMENT_NOTES 规范

参考实现
- 封装与注册：[filename](api/modules/llm_api/llm_api.py)
- 实现层（流/非流）：[filename](api/modules/llm_api/impl.py)
- 管理器/解析：[filename](api/modules/llm_api/impl.py)
- 变量/常量：[filename](api/modules/llm_api/variables.py)