import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'trashfoot_theme';

export type Theme = 'light' | 'dark';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Save theme to storage
  useEffect(() => {
    if (!isLoading) {
      const saveTheme = async () => {
        try {
          await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
          console.error('Error saving theme:', error);
        }
      };
      saveTheme();
    }
  }, [theme, isLoading]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const colors = theme === 'dark' ? {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    primary: '#0EA5E9',
    primaryVariant: '#8B5CF6',
    text: '#FFFFFF',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#334155',
  } : {
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceSecondary: '#E2E8F0',
    primary: '#0EA5E9',
    primaryVariant: '#8B5CF6',
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#E2E8F0',
  };

  return {
    theme,
    colors,
    isLoading,
    toggleTheme,
    setTheme,
  };
});