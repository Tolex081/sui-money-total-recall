'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const KEY = 'sm-theme';
// Mirrors the inline script in layout.tsx: a saved choice wins, otherwise the system setting.
const current = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
const saved = (): Theme | null => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } };

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => { if (!saved()) document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'; setTheme(current()); };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  function toggle() {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* storage unavailable: the choice lasts for this page only */ }
    setTheme(next);
  }
  const dark = theme === 'dark';
  // Rendered without an icon until mounted so the server and first client render match.
  return <button type="button" className="icon-button theme-toggle" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
    {theme === null ? <span className="theme-toggle-placeholder" aria-hidden="true"/> : dark ? <Sun size={18} aria-hidden="true"/> : <Moon size={18} aria-hidden="true"/>}
  </button>;
}
