'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = 'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(params: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
}): void {
  const { active, containerRef, onEscape } = params;

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    containerRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusable = [...containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, containerRef, onEscape]);
}
