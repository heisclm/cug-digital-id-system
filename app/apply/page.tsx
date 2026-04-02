'use client';

import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/dashboard-layout';

const ApplyForm = dynamic(() => import('@/components/apply-form'), { 
  ssr: false,
  loading: () => <div className="animate-pulse space-y-8">
    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-3xl w-1/3" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 h-96 bg-gray-100 dark:bg-gray-800 rounded-3xl" />
      <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-3xl" />
    </div>
  </div>
});

export default function ApplyPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
            ID Card <span className="text-orange-500">Application</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-medium max-w-2xl">
            Complete the form below to request your official digital student identification card.
          </p>
        </div>
        <ApplyForm />
      </div>
    </DashboardLayout>
  );
}
