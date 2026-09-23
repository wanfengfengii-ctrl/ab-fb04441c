import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';

describe('App 渲染冒烟', () => {
  it('首屏包含剂量图、孔径与综合入口', () => {
    const html = renderToString(<App />);
    expect(html).toContain('电子束直写');
    expect(html).toContain('剂量图');
    expect(html).toContain('允许孔径');
    expect(html).toContain('启动综合');
    // 默认 3×3 网格 9 个输入框
    expect(html.match(/cell-input/g)?.length).toBe(9);
  });
});
