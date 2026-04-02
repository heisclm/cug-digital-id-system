'use client';

import React from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { UserCircle, Mail, Phone, GraduationCap } from 'lucide-react';

export default function ProfilePage() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your personal information.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-orange-100 dark:bg-orange-500/10 text-orange-600 rounded-2xl flex items-center justify-center font-bold text-3xl uppercase border-4 border-white dark:border-gray-900 shadow-xl shadow-orange-500/10">
              {profile.fullName.substring(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.fullName}</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium">{profile.role}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-100 dark:border-gray-800">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-2">
                <Mail size={14} /> Email Address
              </label>
              <div className="font-medium text-gray-900 dark:text-white">{profile.email}</div>
            </div>
            {profile.phoneNumber && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-2">
                  <Phone size={14} /> Phone Number
                </label>
                <div className="font-medium text-gray-900 dark:text-white">{profile.phoneNumber}</div>
              </div>
            )}
            {profile.studentId && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-2">
                  <GraduationCap size={14} /> Student ID
                </label>
                <div className="font-medium text-gray-900 dark:text-white">{profile.studentId}</div>
              </div>
            )}
            {profile.department && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-2">
                  <GraduationCap size={14} /> Department
                </label>
                <div className="font-medium text-gray-900 dark:text-white">{profile.department}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
