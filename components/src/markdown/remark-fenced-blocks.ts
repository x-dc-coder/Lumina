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
 * split back into standalone fence paragraphs before matching.
 */

interface MdastNode {
  type: string
  [key: string]: unknown
}

interface MdastParent extends MdastNode {
  children: MdastNode[]
}

function isOpeningFence(node: MdastNode): boolean {
  if (node.type !== 'paragraph') return false
  const parent = node as MdastParent
  if (parent.children.length === 0) return false
  if (parent.children.length > 1) return false
  const firstChild = parent.children[0]
  if (firstChild.type !== 'text') return false
  const value = (firstChild as unknown as { value: string }).value
  return /^:::\w+/.test(value)
}

function parseOpeningFence(node: MdastNode): { type: string; props: string } {
  const parent = node as MdastParent
  const firstChild = parent.children[0] as unknown as { value: string }
  const text = firstChild.value
  const match = text.match(/^:::(\w+)(?:\{([^}]*)\})?\s*$/)
  if (!match) return { type: '', props: '' }
  return { type: match[1], props: match[2] || '' }
}

function isClosingFence(node: MdastNode): boolean {
  if (node.type !== 'paragraph') return false
  const parent = node as MdastParent
  if (parent.children.length === 0) return false
  if (parent.children.length > 1) return false
  const firstChild = parent.children[0]
  if (firstChild.type !== 'text') return false
  const value = (firstChild as unknown as { value: string }).value
  return /^:::\s*$/.test(value)
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

  // No closing found
  return null
}

/** 开栏行与内容同段：首个 text 以 `:::type{props}` + 换行开头（markdown 相邻行合并所致） */
const MERGED_OPENING_FENCE = /^(:::\w+(?:\{[^}]*\})?)[ \t]*\r?\n/
/** 关栏行与内容同段：末个 text 以换行 + `:::` 结尾 */
const MERGED_CLOSING_FENCE = /\r?\n[ \t]*:::[ \t]*$/

/**
 * 拆分「围栏与内容同段」的段落。
 *
 * markdown 会把相邻行合并为同一段落，当开栏行后无空行直接跟内容（或关栏行
 * 紧跟内容行）时，围栏不再是独立段落，isOpeningFence / isClosingFence 无法识别，
 * 整段会按纯文本渲染。此处把首行开栏、末行关栏从段落中拆出还原为独立围栏段落，
 * 交由原有识别逻辑处理；其余场景原样返回。
 */
function splitFenceParagraph(node: MdastNode): MdastNode[] {
  if (node.type !== 'paragraph') return [node]
  const parent = node as MdastParent
  if (parent.children.length === 0) return [node]

  const children = [...parent.children]
  let opening: MdastNode | null = null
  let closing: MdastNode | null = null

  const first = children[0]
  if (first.type === 'text') {
    const firstText = first as unknown as { value: string }
    const openMatch = firstText.value.match(MERGED_OPENING_FENCE)
    if (openMatch) {
      opening = {
        type: 'paragraph',
        children: [{ type: 'text', value: openMatch[1] }],
      }
      const rest = firstText.value.slice(openMatch[0].length)
      if (rest) firstText.value = rest
      else children.shift()
    }
  }

  if (children.length > 0) {
    const last = children[children.length - 1]
    if (last.type === 'text') {
      const lastText = last as unknown as { value: string }
      const closeMatch = lastText.value.match(MERGED_CLOSING_FENCE)
      if (closeMatch) {
        const content = lastText.value.slice(0, closeMatch.index)
        if (content) lastText.value = content
        else children.pop()
        closing = {
          type: 'paragraph',
          children: [{ type: 'text', value: ':::' }],
        }
      }
    }
  }

  if (!opening && !closing) return [node]
  if (opening && closing) return [opening, paragraph(children), closing]
  if (opening) return [opening, paragraph(children)]
  return [paragraph(children), closing as MdastNode]
}

function paragraph(children: MdastNode[]): MdastNode {
  return { type: 'paragraph', children }
}

function processChildren(children: MdastNode[]): MdastNode[] {
  const result: MdastNode[] = []
  let i = 0
  const nodes = children.flatMap(splitFenceParagraph)

  while (i < nodes.length) {
    const node = nodes[i]

    if (isOpeningFence(node)) {
      const { type, props } = parseOpeningFence(node)
      const blockResult = collectFencedBlock(nodes, i + 1)

      if (blockResult) {
        const { contentNodes, endIndex } = blockResult

        // Recursively process content nodes
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

    // For non-fence nodes, recursively process their children
    if ('children' in node && Array.isArray((node as MdastParent).children)) {
      const parent = node as MdastParent
      parent.children = processChildren(parent.children)
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
