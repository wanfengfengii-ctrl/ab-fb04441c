import { describe, it, expect } from 'vitest';
import { parseImport } from './parse';

describe('parseImport', () => {
  it('纯文本剂量图（空白/逗号分隔）', () => {
    expect(parseImport('1 0 2\n0 3 1')).toEqual({
      grid: [
        [1, 0, 2],
        [0, 3, 1],
      ],
    });
    expect(parseImport('1,0,2,\n0,3,1,')).toEqual({
      grid: [
        [1, 0, 2],
        [0, 3, 1],
      ],
    });
  });

  it('中文逗号与空行', () => {
    expect(parseImport('\n1，0\n0，1\n')).toEqual({
      grid: [
        [1, 0],
        [0, 1],
      ],
    });
  });

  it('JSON 形态可只带 grid 或 apertures', () => {
    expect(parseImport('{"grid":[[1,0],[0,1]]}')).toEqual({
      grid: [
        [1, 0],
        [0, 1],
      ],
    });
    const r = parseImport('{"grid":[[1]],"apertures":[[2,2],[1,3]]}');
    expect(r.apertures).toEqual([
      { height: 2, width: 2 },
      { height: 1, width: 3 },
    ]);
  });

  it('行数/列数/非整数报错', () => {
    expect(() => parseImport('1 0\n')).toThrow(/2~5 行/);
    expect(() => parseImport('1\n2\n')).toThrow(/2~6 列/);
    expect(() => parseImport('1 a\n0 1')).toThrow(/不是整数/);
    expect(() => parseImport('1 0\n0 2')).not.toThrow();
    expect(() => parseImport('1 2 3\n0 1')).toThrow(/列数不一致|应为 3/);
  });

  it('JSON 非法时报错', () => {
    expect(() => parseImport('{bad json}')).toThrow(/JSON/);
    expect(() => parseImport('{"apertures":[1,2]}')).toThrow(/二元数组/);
  });
});
