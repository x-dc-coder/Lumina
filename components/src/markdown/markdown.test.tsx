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
})
