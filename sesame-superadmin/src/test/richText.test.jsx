import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import { RichText } from '../lib/richText';

describe('RichText', () => {
  test('renders bold, italic, lists and links without injecting HTML', () => {
    const { container } = render(<RichText text={'**Important** et *note*\n\n- un\n- deux\n\nVoir https://sesame.tn. <script>x</script>'} />);
    expect(container.querySelector('strong').textContent).toBe('Important');
    expect(container.querySelector('em').textContent).toBe('note');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('a').getAttribute('href')).toBe('https://sesame.tn');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>x</script>');
  });
});
