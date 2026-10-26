/**
 * remark-fenced-blocks.ts
 *
 * remark plugin that scans for `:::type{props}` ... `:::` blocks
 * and converts them to custom mdast nodes.
 *
 * Custom mdast node format:
 *   { type: 'callout', data: { hName: 'callout', hProperties: { type: 'info' } }, children: [...] }
 *
 * remark-rehype will convert the custom node to a hast element
 * (tagName='callout'), and react-markdown's `components` prop
 * maps it to a React component.
 *
 * Supported types: callout, card, steps, step
 * Nesting: :::steps can contain multiple :::step blocks.
 * Unclosed fences are left as plain text (no error).
 * Adjacency: fences may be written without blank lines around the content
 * (markdown merges adjacent lines into one paragraph); such paragraphs are
 * split by line into standalone fence paragraphs before matching.
 */

export const SUPPORTED_FENCE_TYPES = ['callout', 'card', 'steps', 'step'] as const
export type SupportedFenceType = (typeof SUPPORTED_FENCE_TYPES)[number]

const SUPPORTED_FENCE_SET = new Set<string>(SUPPORTED_FENCE_TYPES)

/**
 * 统一严格开栏正则：仅匹配白名单中的合法组件名，支持可选属性语法。
 * 格式示例：`:::callout` 或 `:::callout{type="info" title="说明"}`。
 * 非白名单或格式不合法（如未闭合的花括号）不作为开栏，回退为普通文本。
 */
const OPENING_FENCE_REGEX = /^:::(callout|card|steps|step)(?:\{([^}]*)\})?\s*$/

/** 统一关栏正则：仅由 `:::` 及周围空白字符构成。 */
const CLOSING_FENCE_REGEX = /^:::\s*$/

interface MdastNode {
  type: string
  [key: string]: unknown
}

interface MdastParent extends MdastNode {
  children: MdastNode[]
}

export function isOpeningFence(node: MdastNode): boolean {
  if (node.type !== 'paragraph') return false
  const parent = node as MdastParent
  if (parent.children.length !== 1) return false
  const firstChild = parent.children[0]
  if (firstChild.type !== 'text') return false
  const value = (firstChild as unknown as { value: string }).value
  return OPENING_FENCE_REGEX.test(value.trim())
}

export function parseOpeningFence(
  node: MdastNode,
): { type: SupportedFenceType; props: string } | null {
  if (node.type !== 'paragraph') return null
  const parent = node as MdastParent
  if (parent.children.length !== 1) return null
  const firstChild = parent.children[0]
  if (firstChild.type !== 'text') return null
  const text = (firstChild as unknown as { value: string }).value.trim()
  const match = text.match(OPENING_FENCE_REGEX)
  if (!match) return null
  const type = match[1] as SupportedFenceType
  if (!SUPPORTED_FENCE_SET.has(type)) return null
  return { type, props: match[2] || '' }
}

export function isClosingFence(node: MdastNode): boolean {
  if (node.type !== 'paragraph') return false
  const parent = node as MdastParent
  if (parent.children.length !== 1) return false
  const firstChild = parent.children[0]
  if (firstChild.type !== 'text') return false
  const value = (firstChild as unknown as { value: string }).value
  return CLOSING_FENCE_REGEX.test(value.trim())
}

function parseProps(propsStr: string): Record<string, string> {
  const props: Record<string, string> = {}
  if (!propsStr) return props

  const regex = /(\w+)=["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(propsStr)) !== null) {
    props[match[1]] = match[2]
  }

  return props
}

function collectFencedBlock(
  children: MdastNode[],
  startIndex: number,
): { contentNodes: MdastNode[]; endIndex: number } | null {
  const contentNodes: MdastNode[] = []
  let depth = 1

  for (let i = startIndex; i < children.length; i++) {
    const node = children[i]

    if (isOpeningFence(node)) {
      depth++
      contentNodes.push(node)
    } else if (isClosingFence(node)) {
      depth--
      if (depth === 0) {
        return { contentNodes, endIndex: i }
      }
      contentNodes.push(node)
    } else {
      contentNodes.push(node)
    }
  }

  // 未找到对应的关栏
  return null
}

/**
 * 将「围栏行与内容同段」的段落按行切分归一化。
 *
 * Markdown 解析器（remark-parse）会将相邻行合并为一个段落。
 * 当 `:::callout` / `:::steps` 等开栏行或 `:::` 关栏行前后没有空行时，
 * 围栏行会混在段落 AST 节点的文本流中。
 *
 * 本函数逐行切分，将开栏行与关栏行剥离为独立的单行段落节点；
 * 连续的普通内容行保留换行符重新组合为普通段落。
 * 所有产出均为纯净的新节点，杜绝任何对原始 AST 节点属性的原地变异（in-place mutation）。
 */
export function splitFenceParagraph(node: MdastNode): MdastNode[] {
  if (node.type !== 'paragraph') return [node]
  const parent = node as MdastParent
  if (parent.children.length === 0) return [node]

  // 快速路径：若不含围栏特征字符串，无需按行切分
  let containsFenceSignal = false
  for (const child of parent.children) {
    if (child.type === 'text' && (child as unknown as { value: string }).value.includes(':::')) {
      containsFenceSignal = true
      break
    }
  }
  if (!containsFenceSignal) return [node]

  // 按换行符切分为行
  interface LineInfo {
    nodes: MdastNode[]
    isPureText: boolean
    textValue: string
  }

  const lines: LineInfo[] = []
  let curNodes: MdastNode[] = []
  let curText = ''
  let curPureText = true

  for (const child of parent.children) {
    if (child.type === 'text') {
      const val = (child as unknown as { value: string }).value
      const parts = val.split(/\r?\n/)
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p]
        if (p > 0) {
          lines.push({
            nodes: curNodes,
            isPureText: curPureText,
            textValue: curText,
          })
          curNodes = []
          curText = ''
          curPureText = true
        }
        if (part.length > 0) {
          curNodes.push({ type: 'text', value: part })
          curText += part
        }
      }
    } else {
      curPureText = false
      curNodes.push({ ...child })
    }
  }

  lines.push({
    nodes: curNodes,
    isPureText: curPureText,
    textValue: curText,
  })

  const result: MdastNode[] = []
  let pendingContentNodes: MdastNode[] = []

  function flushPending() {
    if (pendingContentNodes.length > 0) {
      result.push({
        type: 'paragraph',
        children: pendingContentNodes,
      })
      pendingContentNodes = []
    }
  }

  for (const line of lines) {
    const trimmed = line.textValue.trim()
    const isOpening = line.isPureText && OPENING_FENCE_REGEX.test(trimmed)
    const isClosing = line.isPureText && CLOSING_FENCE_REGEX.test(trimmed)

    if (isOpening) {
      flushPending()
      result.push({
        type: 'paragraph',
        children: [{ type: 'text', value: trimmed }],
      })
    } else if (isClosing) {
      flushPending()
      result.push({
        type: 'paragraph',
        children: [{ type: 'text', value: ':::' }],
      })
    } else {
      if (line.nodes.length > 0) {
        if (pendingContentNodes.length > 0) {
          pendingContentNodes.push({ type: 'text', value: '\n' })
        }
        pendingContentNodes.push(...line.nodes)
      }
    }
  }

  flushPending()
  return result.length > 0 ? result : [node]
}

/**
 * 提取列表（list）或引用（blockquote）末尾由 CommonMark 惰性延续（lazy continuation）
 * 误吞入的关栏标记 `:::`，将其从容器末尾移除并作为独立段落返回。
 */
function extractTrailingLazyClosingFence(node: MdastNode): MdastNode | null {
  if (node.type === 'blockquote') {
    const parent = node as MdastParent
    if (parent.children.length > 0) {
      const last = parent.children[parent.children.length - 1]
      if (isClosingFence(last)) {
        parent.children.pop()
        return last
      }
    }
  } else if (node.type === 'list') {
    const listParent = node as MdastParent
    if (listParent.children.length > 0) {
      const lastItem = listParent.children[listParent.children.length - 1] as MdastParent
      if (lastItem.children.length > 0) {
        const lastChild = lastItem.children[lastItem.children.length - 1]
        if (isClosingFence(lastChild)) {
          lastItem.children.pop()
          return lastChild
        }
      }
    }
  }
  return null
}

function processChildren(children: MdastNode[]): MdastNode[] {
  // 第一步：先对所有段落执行按行切分归一化
  const splitNodes = children.flatMap(splitFenceParagraph)

  // 第二步：处理列表/引用内部各层级并提升末尾惰性延续关栏
  const normalizedNodes: MdastNode[] = []
  for (const node of splitNodes) {
    if ('children' in node && Array.isArray((node as MdastParent).children)) {
      const parent = node as MdastParent
      parent.children = processChildren(parent.children)
      const trailingClosing = extractTrailingLazyClosingFence(node)
      normalizedNodes.push(node)
      if (trailingClosing) {
        normalizedNodes.push(trailingClosing)
      }
    } else {
      normalizedNodes.push(node)
    }
  }

  // 第三步：收集并递归解析围栏块
  const result: MdastNode[] = []
  let i = 0

  while (i < normalizedNodes.length) {
    const node = normalizedNodes[i]

    const opening = parseOpeningFence(node)
    if (opening) {
      const { type, props } = opening
      const blockResult = collectFencedBlock(normalizedNodes, i + 1)

      if (blockResult) {
        const { contentNodes, endIndex } = blockResult
        const processedContent = processChildren(contentNodes)

        const customNode: MdastNode = {
          type,
          data: {
            hName: type,
            hProperties: parseProps(props),
          },
          children: processedContent,
        }

        result.push(customNode)
        i = endIndex + 1
        continue
      }
    }

    result.push(node)
    i++
  }

  return result
}

export function remarkFencedBlocks() {
  return (tree: MdastNode) => {
    if (!('children' in tree) || !Array.isArray((tree as MdastParent).children))
      return

    const parent = tree as MdastParent
    parent.children = processChildren(parent.children)
  }
}
