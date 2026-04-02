'use client';

import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  GraduationCap,
  UserCircle,
  QrCode
} from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { usePaystackPayment } from 'react-paystack';
import { useAuth } from '@/lib/auth-context';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm shadow-gray-500/5 space-y-4 transition-colors"
  >
    <div className="flex items-center justify-between">
      <div className={`p-3 rounded-2xl ${color} bg-opacity-10 text-opacity-100`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-lg">
          <TrendingUp size={12} />
          {trend}
        </div>
      )}
    </div>
    <div>
      <div className="text-sm font-medium text-gray-400 dark:text-gray-500">{title}</div>
      <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</div>
    </div>
  </motion.div>
);

const useCurrentTime = () => {
  const [time, setTime] = useState<number | null>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTime(Date.now()));
    const interval = setInterval(() => setTime(Date.now()), 1000 * 60 * 60);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);
  return time;
};

export default function StudentDashboard() {
  const { profile, idCard } = useAuth();
  const [latestApp, setLatestApp] = useState<any>(null);
  const currentTime = useCurrentTime();
  
  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'applications'), 
      where('studentUid', '==', profile.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        apps.sort((a: any, b: any) => {
          const timeA = a.submittedAt?.toMillis() || 0;
          const timeB = b.submittedAt?.toMillis() || 0;
          return timeB - timeA;
        });
        setLatestApp(apps[0]);
      }
    });
    return () => unsubscribe();
  }, [profile]);

  const config = {
    reference: (new Date()).getTime().toString(),
    email: profile?.email || '',
    amount: 5000,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    metadata: {
      applicationId: latestApp?.id,
      studentUid: profile?.uid,
      studentId: latestApp?.studentId,
      custom_fields: [
        {
          display_name: "Student ID",
          variable_name: "student_id",
          value: latestApp?.studentId
        }
      ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = (reference: any) => {
    console.log('Payment successful:', reference);
  };

  const onClose = () => {
    console.log('Payment closed');
  };

  const daysToExpiry = React.useMemo(() => {
    if (!idCard?.expiryDate || currentTime === null) return null;
    return Math.ceil((idCard.expiryDate.toDate().getTime() - currentTime) / (1000 * 60 * 60 * 24));
  }, [idCard, currentTime]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {profile?.fullName?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Here&apos;s what&apos;s happening with your digital ID.</p>
        </div>
        <div className="flex gap-3">
          {latestApp?.status === 'APPROVED' && !idCard && (
            <button 
              onClick={() => initializePayment({ onSuccess, onClose })}
              className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-500/20 hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <CreditCard size={20} />
              Pay for ID (GHS 50.00)
            </button>
          )}
          <Link href="/apply">
            <button className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2">
              <CreditCard size={20} />
              {idCard ? 'Apply for Renewal' : 'Apply for New ID'}
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="ID Status" 
          value={idCard ? 'Active' : (latestApp?.status || 'No Active ID')} 
          icon={CheckCircle2} 
          color={idCard ? 'bg-green-500' : (latestApp?.status === 'PENDING' ? 'bg-orange-500' : 'bg-gray-500')} 
        />
        <StatCard title="Days to Expiry" value={daysToExpiry !== null ? `${daysToExpiry} Days` : 'N/A'} icon={Clock} color="bg-blue-500" />
        <StatCard title="Application Type" value={latestApp?.type || 'N/A'} icon={GraduationCap} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Digital ID Preview</h2>
            {idCard && <button className="text-orange-600 dark:text-orange-500 font-bold text-sm hover:underline">Download PDF</button>}
          </div>
          
          {idCard ? (
            <div className="relative aspect-[1.6/1] w-full max-w-md mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2rem] p-6 sm:p-8 text-white shadow-2xl shadow-orange-500/30 overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-white/10 rounded-full -mr-24 sm:-mr-32 -mt-24 sm:-mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-500" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest opacity-80">Catholic University of Ghana</div>
                    <div className="text-base sm:text-lg font-black tracking-tight">STUDENT ID</div>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                    <GraduationCap size={20} className="sm:w-6 sm:h-6" />
                  </div>
                </div>

                <div className="flex gap-4 sm:gap-6 items-end">
                  <div className="relative w-20 h-28 sm:w-24 sm:h-32 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 flex items-center justify-center overflow-hidden shrink-0">
                    {idCard.photoUrl ? (
                      <Image 
                        src={idCard.photoUrl} 
                        alt="Student" 
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-white/40"><UserCircle size={40} className="sm:w-12 sm:h-12" /></div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 sm:space-y-4 min-w-0">
                    <div>
                      <div className="text-[8px] sm:text-[10px] font-bold uppercase opacity-60">Full Name</div>
                      <div className="text-sm sm:text-lg font-bold leading-tight truncate">{idCard.fullName}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div>
                        <div className="text-[8px] sm:text-[10px] font-bold uppercase opacity-60">Student ID</div>
                        <div className="text-xs sm:text-sm font-bold truncate">{idCard.studentId}</div>
                      </div>
                      <div>
                        <div className="text-[8px] sm:text-[10px] font-bold uppercase opacity-60">Expiry</div>
                        <div className="text-xs sm:text-sm font-bold">{idCard.expiryDate?.toDate().toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="aspect-[1.6/1] w-full max-w-md mx-auto bg-gray-50 dark:bg-gray-800 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <CreditCard size={48} className="text-gray-300 dark:text-gray-600" />
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white">No Active Digital ID</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Apply for an ID card to see your digital preview here.</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 text-center transition-colors">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Verification QR</h2>
          <div className="aspect-square w-full max-w-[200px] mx-auto bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center p-4">
            {idCard?.qrPayload || idCard?.qrData ? (
              <div className="bg-white p-2 rounded-xl">
                <QRCodeSVG value={idCard.qrPayload || idCard.qrData} size={160} />
              </div>
            ) : (
              <div className="text-center space-y-2">
                <QrCode size={120} className="text-gray-300 dark:text-gray-600 mx-auto" />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">No Active ID</p>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium px-4">
            Present this QR code to security personnel for campus access.
          </p>
          <button className="w-full py-4 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
            Refresh Code
          </button>
        </div>
      </div>
    </div>
  );
}
