'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Users,
  ShieldCheck,
  QrCode,
  GraduationCap,
  UserCircle,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
import Link from 'next/link';

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

const StudentDashboard = () => {
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
        // Sort by submittedAt descending
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

  const daysToExpiry = React.useMemo(() => {
    if (!idCard?.expiryDate || currentTime === null) return null;
    return Math.ceil((idCard.expiryDate.toDate().getTime() - currentTime) / (1000 * 60 * 60 * 24));
  }, [idCard, currentTime]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {profile?.fullName.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Here&apos;s what&apos;s happening with your digital ID.</p>
        </div>
        <Link href="/apply">
          <button className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2">
            <CreditCard size={20} />
            {idCard ? 'Apply for Renewal' : 'Apply for New ID'}
          </button>
        </Link>
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
            {idCard?.qrData ? (
              <div className="bg-white p-2 rounded-xl">
                <QRCodeSVG value={idCard.qrData} size={160} />
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
};

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingApprovals: 0,
    activeIDs: 0,
    securityScans: 0
  });
  const [recentApps, setRecentApps] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'STUDENT')));
      const pendingSnap = await getDocs(query(collection(db, 'applications'), where('status', '==', 'PENDING')));
      const activeIDsSnap = await getDocs(query(collection(db, 'id_cards'), where('status', '==', 'ACTIVE')));
      
      setStats(prev => ({
        ...prev,
        totalStudents: studentsSnap.size,
        pendingApprovals: pendingSnap.size,
        activeIDs: activeIDsSnap.size
      }));
    };

    const unsubscribeScans = onSnapshot(collection(db, 'scans'), (snapshot) => {
      setStats(prev => ({ ...prev, securityScans: snapshot.size }));
    });

    const unsubscribeApps = onSnapshot(
      query(collection(db, 'applications'), orderBy('submittedAt', 'desc'), limit(5)),
      (snapshot) => {
        setRecentApps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    fetchStats();
    return () => {
      unsubscribeApps();
      unsubscribeScans();
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Manage applications and system health.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Students" value={stats.totalStudents.toLocaleString()} icon={Users} color="bg-blue-500" trend="+12%" />
        <StatCard title="Pending Approvals" value={stats.pendingApprovals.toLocaleString()} icon={Clock} color="bg-orange-500" />
        <StatCard title="Active IDs" value={stats.activeIDs.toLocaleString()} icon={CheckCircle2} color="bg-green-500" trend="+8%" />
        <StatCard title="Security Scans" value={stats.securityScans.toLocaleString()} icon={ShieldCheck} color="bg-purple-500" />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 dark:text-white">Recent Applications</h2>
          <Link href="/admin/approvals">
            <button className="text-orange-600 dark:text-orange-500 font-bold text-sm flex items-center gap-1">
              View All <ArrowRight size={14} />
            </button>
          </Link>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {recentApps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 font-bold text-xs uppercase">
                        {app.fullName.substring(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800 dark:text-white">{app.fullName}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{app.studentId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">{app.type} ID</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {app.submittedAt?.toDate().toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full w-fit ${
                      app.status === 'PENDING' ? 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' :
                      app.status === 'APPROVED' ? 'text-green-500 bg-green-50 dark:bg-green-500/10' :
                      'text-red-500 bg-red-50 dark:bg-red-500/10'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${
                        app.status === 'PENDING' ? 'bg-orange-500' :
                        app.status === 'APPROVED' ? 'bg-green-500' :
                        'bg-red-500'
                      }`} />
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href="/admin/approvals">
                      <button className="px-4 py-2 bg-gray-900 dark:bg-orange-500 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                        Review
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const { profile } = useAuth();

  return (
    <DashboardLayout>
      {profile?.role === 'ADMIN' ? <AdminDashboard /> : <StudentDashboard />}
    </DashboardLayout>
  );
}
