/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownLite } from './markdown-lite'

afterEach(() => {
  cleanup()
})

describe('MarkdownLite 渲染', () => {
  it('相邻行围栏（开栏后无空行）渲染为 callout 卡片', () => {
    const { container } = render(
      <MarkdownLite>
        {':::callout{type="info"}\n**核心思想**：先粗筛再精排。\n:::'}
      </MarkdownLite>,
    )

    const callout = container.querySelector('div.my-4')
    expect(callout).toBeTruthy()
    expect(callout?.className).toContain('border-lagoon/20')
    expect(screen.getByText('核心思想')).toBeTruthy()
    expect(container.textContent).not.toContain(':::')
  })

  it('表格包装在横向滚动容器内，行内代码不逐字符断行并正确透传属性', () => {
    const { container } = render(
      <MarkdownLite>
        {
          '| 脚本 | 输出 |\n| --- | --- |\n| `02_gen_query_opt.py` | `law_names` |'
        }
      </MarkdownLite>,
    )

    const table = container.querySelector('table')
    expect(table).toBeTruthy()
    expect(table?.className).toContain('my-0!')
    const wrapper = table?.parentElement
    expect(wrapper?.className).toContain('w-full')
    expect(wrapper?.className).toContain('overflow-x-auto')
    expect(wrapper?.className).toContain('my-6')
    expect(wrapper?.className).not.toContain('break-all')
    expect(screen.getByText('02_gen_query_opt.py')).toBeTruthy()
  })

  it('无空行嵌套 :::steps 与 :::step 正确渲染，不触发空标签崩溃', () => {
    const raw = [
      ':::steps',
      ':::step',
      '执行数据召回分析',
      ':::',
      ':::step',
      '执行二次排序验证',
      ':::',
      ':::',
    ].join('\n')

    const { container } = render(<MarkdownLite>{raw}</MarkdownLite>)

    expect(container.querySelector('ol')).toBeTruthy()
    expect(container.querySelectorAll('li').length).toBe(2)
    expect(screen.getByText('执行数据召回分析')).toBeTruthy()
    expect(screen.getByText('执行二次排序验证')).toBeTruthy()
    expect(container.textContent).not.toContain(':::')
  })

  it('连续相邻无空行围栏分别正确渲染为独立组件', () => {
    const raw = [
      ':::callout{type="info"}',
      '第一个提示卡片',
      ':::',
      ':::callout{type="warning"}',
      '第二个警告卡片',
      ':::',
    ].join('\n')

    const { container } = render(<MarkdownLite>{raw}</MarkdownLite>)

    expect(screen.getByText('第一个提示卡片')).toBeTruthy()
    expect(screen.getByText('第二个警告卡片')).toBeTruthy()
    const callouts = container.querySelectorAll('div.my-4')
    expect(callouts.length).toBe(2)
    expect(container.textContent).not.toContain(':::')
  })

  it('非标准开栏语法或未闭合开栏头安全回退为普通文本，无空标签白屏', () => {
    const raw = [
      ':::unknownComponent{foo="bar"}',
      '非标准组件内容',
      ':::',
      ':::step{unclosedBracket',
      '语法错误的内容',
    ].join('\n')

    const { container } = render(<MarkdownLite>{raw}</MarkdownLite>)

    expect(screen.getByText(/:::unknownComponent/)).toBeTruthy()
    expect(screen.getByText(/:::step{unclosedBracket/)).toBeTruthy()
    // 确保没有生成空标签 node
    expect(container.querySelector(':not([class])')?.tagName.toLowerCase()).not.toBe('')
  })

  it('列表尾行紧贴关栏（CommonMark 惰性延续）时外层围栏正常闭合', () => {
    const raw = [
      ':::callout{type="info"}',
      '* 第一项列表',
      '* 第二项列表',
      ':::',
    ].join('\n')

    const { container } = render(<MarkdownLite>{raw}</MarkdownLite>)

    const callout = container.querySelector('div.my-4')
    expect(callout).toBeTruthy()
    expect(screen.getByText('第一项列表')).toBeTruthy()
    expect(screen.getByText('第二项列表')).toBeTruthy()
    expect(container.textContent).not.toContain(':::')
  })

  it('引用块尾行紧贴关栏时外层围栏正常闭合', () => {
    const raw = [
      ':::callout{type="info"}',
      '> 引用块正文内容',
      ':::',
    ].join('\n')

    const { container } = render(<MarkdownLite>{raw}</MarkdownLite>)

    const callout = container.querySelector('div.my-4')
    expect(callout).toBeTruthy()
    expect(screen.getByText('引用块正文内容')).toBeTruthy()
    expect(container.textContent).not.toContain(':::')
  })
})
