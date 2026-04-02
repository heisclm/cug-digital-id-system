'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Check, X, Eye, Loader2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { sendNotification } from '@/lib/notifications';

export default function ApprovalsPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  useEffect(() => {
    if (profile?.role !== 'ADMIN') return;

    const q = query(collection(db, 'applications'), where('status', '==', 'PENDING'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(apps);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleAction = async (app: any, status: 'APPROVED' | 'REJECTED') => {
    try {
      await updateDoc(doc(db, 'applications', app.id), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: profile?.uid,
      });

      if (status === 'APPROVED') {
        // Send approval notification
        await sendNotification(
          app.studentUid,
          'Application Approved',
          `Congratulations! Your ID card application has been approved. Please proceed to payment to generate your digital ID.`,
          'success'
        );
      } else {
        // Send rejection notification
        await sendNotification(
          app.studentUid,
          'Application Rejected',
          `Your ID card application was rejected. Please check your details and try again.`,
          'error'
        );
      }

      setSelectedApp(null);
    } catch (error) {
      console.error('Error updating application:', error);
      alert('Failed to update application');
    }
  };

  if (profile?.role !== 'ADMIN') {
    return <div className="p-8 text-center font-bold text-red-500">Unauthorized Access</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Application Approvals</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Review and process student ID requests.</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-orange-500" /></div>
        ) : applications.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-20 text-center border border-gray-100 dark:border-gray-800">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
              <Clock size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">No Pending Applications</h3>
            <p className="text-gray-400 dark:text-gray-500 text-sm">All caught up! Check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {applications.map((app) => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <div className="aspect-video relative bg-gray-100 dark:bg-gray-800">
                    <Image 
                      src={app.photoUrl} 
                      alt="Passport" 
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-full text-[10px] font-bold text-orange-600 dark:text-orange-500 shadow-sm z-10">
                      {app.type}
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white text-lg leading-tight">{app.fullName}</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{app.studentId} • {app.department}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(app, 'APPROVED')}
                        className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-green-600 transition-colors"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleAction(app, 'REJECTED')}
                        className="flex-1 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
