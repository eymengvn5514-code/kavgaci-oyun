import { useEffect, useRef } from 'react';

/**
 * Basit klavye durumu. setSkillDown ile tek seferlik tetikleme (skill) yapılır.
 */
export function useKeyboard() {
  const pressed = useRef<Record<string, boolean>>({});
  const justPressed = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!pressed.current[e.code]) justPressed.current[e.code] = true;
      pressed.current[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      pressed.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return { pressed, justPressed };
}
