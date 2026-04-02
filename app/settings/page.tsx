'use client';

import React from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useTheme } from 'next-themes';
import { Moon, Sun, Bell, Shield, Key } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your app preferences.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-8">
            {/* Appearance */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Sun size={16} className="text-orange-500" /> Appearance
              </h2>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Theme</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Select your preferred color theme</div>
                </div>
                <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-xl">
                  <button
                    onClick={() => setTheme('light')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'light' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Bell size={16} className="text-orange-500" /> Notifications
              </h2>
              <div className="space-y-2">
                {[
                  { title: 'Push Notifications', desc: 'Receive alerts on your device' },
                  { title: 'Email Notifications', desc: 'Receive updates via email' },
                  { title: 'Application Updates', desc: 'Get notified about your ID status' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{item.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Shield size={16} className="text-orange-500" /> Security
              </h2>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">Change Password</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Update your account password</div>
                  </div>
                  <Key size={20} className="text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
