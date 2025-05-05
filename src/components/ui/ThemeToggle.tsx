"use client";

import React from 'react';
import { Button } from './button';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={`rounded-full p-2 ${
          theme === 'light' ? 'bg-white shadow-sm text-black' : 'text-gray-400'
        }`}
        aria-label="Light mode"
      >
        <Sun className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={`rounded-full p-2 ${
          theme === 'dark' ? 'bg-gray-700 shadow-sm text-white' : 'text-gray-400'
        }`}
        aria-label="Dark mode"
      >
        <Moon className="h-5 w-5" />
      </Button>
    </div>
  );
} 