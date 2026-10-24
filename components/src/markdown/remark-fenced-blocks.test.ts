import { describe, expect, it } from 'vitest'
import { remarkFencedBlocks } from './remark-fenced-blocks'

function createAst(children: unknown[]) {
  return { type: 'root', children }
}

function paragraph(text: string) {
  return { type: 'paragraph', children: [{ type: 'text', value: text }] }
}

describe('remarkFencedBlocks', () => {
  it('converts :::callout to custom callout node', () => {
    const tree = createAst([
      paragraph(':::callout'),
      paragraph('Hello world'),
      paragraph(':::'),
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'callout')
    expect(tree.children[0]).toHaveProperty('data.hName', 'callout')
    expect(tree.children[0]).toHaveProperty('data.hProperties', {})
    expect((tree.children[0] as { children: unknown[] }).children).toHaveLength(1)
    expect((tree.children[0] as { children: { type: string }[] }).children[0].type).toBe('paragraph')
  })

  it('converts :::callout with props to custom node with hProperties', () => {
    const tree = createAst([
      paragraph(':::callout{type="info"}'),
      paragraph('Hello world'),
      paragraph(':::'),
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'callout')
    expect(tree.children[0]).toHaveProperty('data.hProperties', { type: 'info' })
  })

  it('converts nested :::steps with :::step blocks', () => {
    const tree = createAst([
      paragraph(':::steps'),
      paragraph(':::step'),
      paragraph('Step 1'),
      paragraph(':::'),
      paragraph(':::step'),
      paragraph('Step 2'),
      paragraph(':::'),
      paragraph(':::'),
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'steps')
    const stepsChildren = (tree.children[0] as { children: unknown[] }).children
    expect(stepsChildren).toHaveLength(2)
    expect((stepsChildren[0] as { type: string }).type).toBe('step')
    expect((stepsChildren[1] as { type: string }).type).toBe('step')
    expect((stepsChildren[0] as { children: { type: string }[] }).children[0].type).toBe('paragraph')
    expect((stepsChildren[1] as { children: { type: string }[] }).children[0].type).toBe('paragraph')
  })

  it('treats unclosed fence as plain text', () => {
    const tree = createAst([
      paragraph(':::callout'),
      paragraph('Hello world'),
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(2)
    expect(tree.children[0]).toHaveProperty('type', 'paragraph')
    expect(tree.children[1]).toHaveProperty('type', 'paragraph')
  })

  it('does not affect code blocks', () => {
    const tree = createAst([
      { type: 'code', lang: 'markdown', value: ':::callout\nHello\n:::\n' },
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'code')
  })

  it('converts :::card with title and href props', () => {
    const tree = createAst([
      paragraph(':::card{title="My Card" href="https://example.com"}'),
      paragraph('Card content'),
      paragraph(':::'),
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'card')
    expect(tree.children[0]).toHaveProperty('data.hProperties', {
      title: 'My Card',
      href: 'https://example.com',
    })
  })

  it('does not affect horizontal rules', () => {
    const tree = createAst([{ type: 'thematicBreak' }])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'thematicBreak')
  })
})

describe('remarkFencedBlocks with fences adjacent to content', () => {
  it('splits a paragraph where opening fence, content and closing fence share one paragraph', () => {
    // markdown 会把相邻行合并为同一段落：开栏行后无空行直接跟内容时，
    // 段落首个 text 以围栏 + 换行开头，末个 text 以换行 + 关栏结尾
    const tree = createAst([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: ':::callout{type="info"}\n' },
          { type: 'emphasis', children: [{ type: 'text', value: '核心思想' }] },
          { type: 'text', value: '：先粗筛再精排，保证召回。\n:::' },
        ],
      },
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'callout')
    expect(tree.children[0]).toHaveProperty('data.hProperties', { type: 'info' })
    const calloutChildren = (tree.children[0] as { children: unknown[] }).children
    expect(calloutChildren).toHaveLength(1)
    expect(JSON.stringify(calloutChildren)).not.toContain(':::')
  })

  it('splits the opening fence when only it is merged with the first content paragraph', () => {
    const tree = createAst([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: ':::callout{type="warning"}\n' },
          { type: 'text', value: 'bm25_rank 字段是恒等值' },
        ],
      },
      paragraph('`03_coarse.py` 中 bm25_rank 为恒等值'),
      paragraph(':::'),
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'callout')
    expect(tree.children[0]).toHaveProperty('data.hProperties', { type: 'warning' })
    expect((tree.children[0] as { children: unknown[] }).children).toHaveLength(2)
  })

  it('splits a closing fence merged into the last content paragraph', () => {
    const tree = createAst([
      paragraph(':::callout{type="warning"}'),
      {
        type: 'paragraph',
        children: [
          { type: 'inlineCode', value: '03_coarse.py' },
          { type: 'text', value: ' 中 bm25_rank 为恒等值\n:::' },
        ],
      },
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'callout')
    const calloutChildren = (tree.children[0] as { children: unknown[] }).children
    expect(calloutChildren).toHaveLength(1)
    expect(JSON.stringify(calloutChildren)).not.toContain(':::')
  })

  it('handles opening merged with first content and closing merged with last content', () => {
    // 对应真实文档形态：开栏与首段（加粗 + 尾随文字）同段，关栏与末段（行内代码 + 文字）同段
    const tree = createAst([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: ':::callout{type="warning"}\n' },
          { type: 'emphasis', children: [{ type: 'text', value: 'bm25_rank 恒等' }] },
          { type: 'text', value: '：首段尾随文字' },
        ],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'inlineCode', value: 'x.py' },
          { type: 'text', value: ' 末段尾行\n:::' },
        ],
      },
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'callout')
    expect(tree.children[0]).toHaveProperty('data.hProperties', { type: 'warning' })
    const calloutChildren = (tree.children[0] as { children: unknown[] }).children
    expect(calloutChildren).toHaveLength(2)
    expect(JSON.stringify(calloutChildren)).not.toContain(':::')
  })

  it('leaves an unclosed merged fence as plain paragraphs', () => {
    const tree = createAst([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: ':::callout{type="info"}\n' },
          { type: 'text', value: 'Hello world' },
        ],
      },
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(2)
    expect(tree.children[0]).toHaveProperty('type', 'paragraph')
    const firstParagraph = (tree.children[0] as { children: { value: string }[] }).children
    expect(firstParagraph[0].value).toBe(':::callout{type="info"}')
    expect(tree.children[1]).toHaveProperty('type', 'paragraph')
  })

  it('does not split plain paragraphs that merely contain ::: text', () => {
    const tree = createAst([
      {
        type: 'paragraph',
        children: [{ type: 'text', value: '正文中提到分隔符 :::' }],
      },
    ])

    const plugin = remarkFencedBlocks()
    plugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toHaveProperty('type', 'paragraph')
    expect((tree.children[0] as { children: unknown[] }).children).toHaveLength(1)
  })
})
