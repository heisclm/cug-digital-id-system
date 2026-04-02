'use client';

import React, { useState, useEffect } from 'react';
import { Search, Moon, Sun, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import NotificationDropdown from './notification-dropdown';

const Navbar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { profile } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!mounted) return null;

  return (
    <div className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 transition-colors">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-gray-500">
          <Menu size={24} />
        </button>
        <div className="relative w-full hidden sm:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Theme Toggle */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <button 
            onClick={() => setTheme('light')}
            className={`p-2 rounded-lg transition-all ${resolvedTheme === 'light' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <Sun size={18} />
          </button>
          <button 
            onClick={() => setTheme('dark')}
            className={`p-2 rounded-lg transition-all ${resolvedTheme === 'dark' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <Moon size={18} />
          </button>
        </div>

        {/* Notifications */}
        <NotificationDropdown />

        <div className="flex items-center gap-3 pl-6 border-l border-gray-100 dark:border-gray-800">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-gray-800 dark:text-white">{profile?.fullName}</div>
            <div className="text-xs text-gray-400 font-medium">{profile?.role}</div>
          </div>
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-600 font-bold border-2 border-orange-50 dark:border-orange-500/20">
            {profile?.fullName?.charAt(0)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
