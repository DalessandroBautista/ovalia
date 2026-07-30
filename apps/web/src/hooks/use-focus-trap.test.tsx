import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useFocusTrap } from './use-focus-trap';

function Harness({ onEscape }: { onEscape: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap({ active: true, containerRef, onEscape });
  return (
    <div ref={containerRef}>
      <button type="button">Primero</button>
      <button type="button">Último</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('lleva el foco al overlay y lo cicla con Tab', async () => {
    const user = userEvent.setup();
    render(<Harness onEscape={() => {}} />);
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
  });

  it('notifica Escape, bloquea scroll y restaura el foco al desmontar', async () => {
    const user = userEvent.setup();
    const previous = document.createElement('button');
    document.body.append(previous);
    previous.focus();
    const onEscape = vi.fn();
    const view = render(<Harness onEscape={onEscape} />);

    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledOnce();

    view.unmount();
    expect(document.body.style.overflow).toBe('');
    expect(previous).toHaveFocus();
    previous.remove();
  });
});
