/**
 * markdown-table.tsx
 *
 * Markdown 表格包装组件：外层提供横向滚动容器，避免窄容器下列宽被压缩、
 * 行内代码被逐字符断行。纵向外边距归属外层滚动包装容器，避免内部表格外边距
 * 将水平滚动条推离表格底边。
 */

import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../lib/utils'

export function MarkdownTable({
  children,
  className,
  style,
  ...rest
}: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="my-6 w-full overflow-x-auto">
      <table className={cn('my-0!', className)} style={style} {...rest}>
        {children}
      </table>
    </div>
  )
}
