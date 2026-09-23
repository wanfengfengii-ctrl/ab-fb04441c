import type { Aperture } from '../solver/types';
import { LIMITS } from '../solver/validate';

interface ApertureEditorProps {
  apertures: Aperture[];
  onChange: (next: Aperture[]) => void;
}

/** 允许孔径列表编辑器：1–8 种，宽高为正整数且不得越界（越界由校验提示） */
export function ApertureEditor({ apertures, onChange }: ApertureEditorProps) {
  const update = (i: number, field: keyof Aperture, raw: string) => {
    const next = apertures.map((a, j) =>
      j === i ? { ...a, [field]: raw === '' ? NaN : Number(raw) } : a,
    );
    onChange(next);
  };

  return (
    <div className="aperture-editor">
      <div className="aperture-list">
        {apertures.map((a, i) => (
          <div className="aperture-row" key={i}>
            <span className="aperture-index">#{i + 1}</span>
            <label>
              高
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isNaN(a.height) ? '' : a.height}
                onChange={(e) => update(i, 'height', e.target.value)}
              />
            </label>
            <span className="times">×</span>
            <label>
              宽
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isNaN(a.width) ? '' : a.width}
                onChange={(e) => update(i, 'width', e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={apertures.length <= LIMITS.minApertures}
              onClick={() => onChange(apertures.filter((_, j) => j !== i))}
              title="删除该孔径"
            >
              删除
            </button>
          </div>
        ))}
      </div>
      <div className="aperture-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={apertures.length >= LIMITS.maxApertures}
          onClick={() => onChange([...apertures, { height: 1, width: 1 }])}
        >
          + 添加孔径
        </button>
        <span className="hint">
          {apertures.length}/{LIMITS.maxApertures} 种
        </span>
      </div>
    </div>
  );
}
