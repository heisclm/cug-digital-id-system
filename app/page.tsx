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
import dynamic from 'next/dynamic';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
import Link from 'next/link';

const StudentDashboard = dynamic(() => import('@/components/student-dashboard'), { 
  ssr: false,
  loading: () => <div className="animate-pulse space-y-8">
    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-3xl w-1/3" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-3xl" />)}
    </div>
    <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded-3xl" />
  </div>
});

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
