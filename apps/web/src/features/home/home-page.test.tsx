import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HomePage } from './home-page';

describe('Ovalia home page', () => {
  it('renders an honest live loading state and core product areas', () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain('OVALIA');
    expect(html).toContain('Rugby Championship');
    expect(html).toContain('URBA Top 14');
    expect(html).toContain('Consultando partidos en vivo');
    expect(html).not.toContain('EN VIVO · 68');
    expect(html).toContain('Prode');
  });
});
