import { useEffect, useState } from 'react';

export type ThemeKey = 'a' | 'b' | 'c' | 'd' | 'e';
const STORAGE_KEY = 'bern5.theme';
const DEFAULT_THEME: ThemeKey = 'c';
const VALID = new Set<ThemeKey>(['a', 'b', 'c', 'd', 'e']);

function readStored(): ThemeKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && VALID.has(v as ThemeKey)) return v as ThemeKey;
  } catch { /* private mode etc. */ }
  return DEFAULT_THEME;
}

/**
 * Manages the active theme key, persists to localStorage, and writes
 * `<html data-theme="x">` so styles/themes.css can swap palettes.
 */
export function useTheme(): [ThemeKey, (t: ThemeKey) => void] {
  const [theme, setTheme] = useState<ThemeKey>(readStored);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  return [theme, setTheme];
}
