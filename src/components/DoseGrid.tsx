interface DoseGridProps {
  values: number[][];
  caption: string;
  tone?: 'target' | 'cumulative' | 'remaining';
  /** 需要高亮的格，元素为 "r,c" */
  highlight?: ReadonlySet<string>;
  footer?: string;
}

/** 只读剂量格矩阵：用于目标 / 累计 / 剩余剂量展示 */
export function DoseGrid({ values, caption, tone = 'target', highlight, footer }: DoseGridProps) {
  return (
    <figure className="dose-grid">
      <figcaption>{caption}</figcaption>
      <table>
        <tbody>
          {values.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => {
                const cls = [
                  'dose-cell',
                  `tone-${tone}`,
                  highlight?.has(`${r},${c}`) ? 'hl' : '',
                  tone === 'remaining' ? (v === 0 ? 'cell-done' : 'cell-todo') : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td key={c} className={cls}>
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <div className="dose-footer">{footer}</div>}
    </figure>
  );
}
