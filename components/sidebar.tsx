'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { 
  LayoutDashboard, 
  UserCircle, 
  CreditCard, 
  ShieldCheck, 
  Settings, 
  LogOut,
  GraduationCap,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/', roles: ['STUDENT', 'ADMIN', 'SECURITY'] },
    { name: 'My Profile', icon: UserCircle, href: '/profile', roles: ['STUDENT'] },
    { name: 'ID Application', icon: CreditCard, href: '/apply', roles: ['STUDENT'] },
    { name: 'Students', icon: UserCircle, href: '/admin/students', roles: ['ADMIN'] },
    { name: 'Approvals', icon: ShieldCheck, href: '/admin/approvals', roles: ['ADMIN'] },
    { name: 'Scanner', icon: ShieldCheck, href: '/security/scan', roles: ['SECURITY', 'ADMIN'] },
    { name: 'Settings', icon: Settings, href: '/settings', roles: ['STUDENT', 'ADMIN', 'SECURITY'] },
  ];

  const filteredItems = menuItems.filter(item => 
    profile && item.roles.includes(profile.role)
  );

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden",
          isOpen ? "block" : "hidden"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-50 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col p-6 transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <GraduationCap size={24} />
            </div>
            <span className="font-bold text-xl text-gray-800 dark:text-white tracking-tight">CUG ID</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-500">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">Menu</div>
          {filteredItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                pathname === item.href 
                  ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 shadow-sm" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-colors",
                pathname === item.href ? "text-orange-600" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
              )} />
              <span className="font-medium">{item.name}</span>
              {pathname === item.href && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-600" />
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
          {mounted && (
            <div className="flex lg:hidden items-center gap-1 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <button 
                onClick={() => setTheme('light')}
                className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${resolvedTheme === 'light' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <Sun size={18} />
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${resolvedTheme === 'dark' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <Moon size={18} />
              </button>
            </div>
          )}
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-4 py-3 w-full text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-medium">Log out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
