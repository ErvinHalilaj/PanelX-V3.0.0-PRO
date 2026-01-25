/**
 * Main App Component
 * Application entry point with theme and routing
 */

import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { Dashboard } from './pages/Dashboard';
import { Button } from './components/Button';

export function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const ThemeIcon =
    theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: resolvedTheme === 'dark' ? 'dark' : '',
          duration: 3000,
          style: {
            background: resolvedTheme === 'dark' ? '#1f2937' : '#fff',
            color: resolvedTheme === 'dark' ? '#fff' : '#000',
          },
        }}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Theme Toggle Button */}
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={cycleTheme}
            title={`Current theme: ${theme}`}
          >
            <ThemeIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Content */}
        <Dashboard />
      </div>
    </>
  );
}
