// SmartTavern Chat Normalizer (v1)
// 作用：与对话文本相关的通用解析/拆分工具，便于组件复用与后续拆分。
// 目前包含：在消息文本中提取/拆分完整 HTML 文档（支持围栏代码块 ```html ... ``` 与纯文本形态）
// 参考现有逻辑：ThreadedChatPreview.vue 中的实现（已抽出为通用函数）

// ============ Type Definitions ============

/**
 * HTML 文档拆分结果
 */
export interface HtmlSplitResult {
  /** 前置文本 */
  before: string;
  /** HTML 文档内容 */
  html: string;
  /** 后置文本 */
  after: string;
}

// ============ Regular Expressions ============

/** 匹配完整 HTML 文档开头（DOCTYPE） */
export const HTML_DOC_RE: RegExp = /<!DOCTYPE\s+html/i

/** 匹配围栏代码块（```html ... ``` 或 ```HTML ... ```），提取中间内容 */
export const FENCE_RE: RegExp = /```(?:html|HTML)?\s*([\s\S]*?)```/i

// ============ Utility Functions ============

/**
 * 判断文本中是否包含完整 HTML 文档
 * @param text - 待检测的文本
 * @returns 是否包含完整 HTML 文档
 */
export function hasHtmlDoc(text: string): boolean {
  return !!extractHtmlDocFromText(text)
}

/**
 * 若文本中包含完整 HTML 文档，返回该 HTML 文档文本，否则返回空串
 * 支持：
 *  - ```html ... ``` 或 ```HTML ... ``` 围栏中包含 <!DOCTYPE html>
 *  - 纯文本中包含 <!DOCTYPE html> ... </html>
 * @param text - 待提取的文本
 * @returns HTML 文档文本，如果不存在则返回空字符串
 */
export function extractHtmlDocFromText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  const fence = text.match(FENCE_RE)
  if (fence && fence[1] && HTML_DOC_RE.test(fence[1])) {
    return fence[1].trim()
  }
  if (HTML_DOC_RE.test(text)) {
    return text.trim()
  }
  return ''
}

/**
 * 将消息文本拆分为 前置文本 / HTML 文档 / 后置文本 三段，仅替换中间代码块
 * 支持：
 *  - ```html ... ``` 或 ```HTML ... ``` 围栏中包含 <!DOCTYPE html> 和 </html>（必须完整）
 *  - 纯文本中包含 <!DOCTYPE html> ... </html>（必须完整）
 * @param text - 待拆分的文本
 * @returns 拆分结果对象，包含 before、html、after 三个字段
 */
export function splitHtmlFromText(text: string): HtmlSplitResult {
  if (!text || typeof text !== 'string') return { before: '', html: '', after: '' }

  // 优先匹配围栏代码块（必须有开始和结束标记）
  const fence = text.match(/```(?:html|HTML)?\s*([\s\S]*?)```/i)
  if (fence && fence[0]) {
    const fenceIdx = text.indexOf(fence[0])
    const code = fence[1] ?? ''
    // 严格检查：必须同时包含 <!DOCTYPE html> 和 </html>
    if (HTML_DOC_RE.test(code) && /<\/html>/i.test(code)) {
      const before = text.slice(0, fenceIdx)
      const after = text.slice(fenceIdx + fence[0].length)
      return { before, html: code.trim(), after }
    }
  }

  // 回退：匹配纯文本中的 <!DOCTYPE html> ... </html>（必须完整）
  const doctypeRe = /<!DOCTYPE\s+html[^>]*>/i
  const endHtmlRe = /<\/html>/i
  const m = text.match(doctypeRe)
  if (m) {
    const start = m.index ?? -1
    if (start >= 0) {
      const tail = text.slice(start)
      const endMatchIdx = tail.search(endHtmlRe)
      // 严格检查：必须找到结束标签
      if (endMatchIdx >= 0) {
        const end = start + endMatchIdx + '</html>'.length
        const before = text.slice(0, start)
        const html = text.slice(start, end).trim()
        const after = text.slice(end)
        return { before, html, after }
      }
    }
  }

  return { before: '', html: '', after: '' }
}