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
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ID Card Application</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Fill in the details below to request your digital ID.</p>
        </div>
        <ApplyForm />
      </div>
    </DashboardLayout>
  );
}
