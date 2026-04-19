import { useState, useCallback, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast';

/**
 * useTheme Hook
 * 
 * Manages the application's appearance state, persisting preferences to localStorage
 * and synchronizing with system color scheme settings.
 * 
 * @returns An object containing the current theme and toggle functions.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  // Initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('eventflow-theme') as Theme | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  // Persistence and DOM Sync
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'high-contrast');
    root.classList.add(theme);
    localStorage.setItem('eventflow-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const toggleHighContrast = useCallback(() => {
    setTheme(prev => prev === 'high-contrast' ? 'light' : 'high-contrast');
  }, []);

  return {
    theme,
    toggleTheme,
    toggleHighContrast,
    setTheme
  };
}
