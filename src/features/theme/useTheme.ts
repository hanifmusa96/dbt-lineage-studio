import { useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lineage-theme';

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('Could not read the saved theme preference:', error);
    return 'light';
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      console.warn('Could not save the theme preference:', error);
    }
  };
  return { theme, toggleTheme };
}
