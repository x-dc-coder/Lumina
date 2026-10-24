/**
 * markdown-table.tsx
 *
 * Markdown 表格包装组件：外层提供横向滚动容器，避免窄容器下列宽被压缩、
 * 行内代码被逐字符断行（与代码块 [&_pre]:overflow-x-auto 策略一致）。
 */

import type { ComponentPropsWithoutRef } from 'react'

export function MarkdownTable({ children, className, style }: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={className} style={style}>
        {children}
      </table>
    </div>
  )
}
