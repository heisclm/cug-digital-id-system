'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs, limit } from 'firebase/firestore';
import { Users, Search, Filter, Mail, Phone, GraduationCap, Trash2, Edit2, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';

interface StudentRecord {
  studentId: string;
  fullName: string;
  department: string;
  program: string;
}

export default function StudentRecordsPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loadedStudents, setLoadedStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'REGISTERED' | 'DATABASE'>('REGISTERED');
  
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; errors: number; message: string } | null>(null);

  useEffect(() => {
    if (profile?.role !== 'ADMIN') return;

    const q = query(collection(db, 'users'), where('role', '==', 'STUDENT'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(docs);
      setLoading(false);
    });

    fetchLoadedStudents();

    return () => unsubscribe();
  }, [profile]);

  const fetchLoadedStudents = async () => {
    try {
      const q = query(collection(db, 'students'), limit(100));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data() as StudentRecord);
      setLoadedStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let successCount = 0;
        let errorCount = 0;

        try {
          const batches = [];
          let currentBatch = writeBatch(db);
          let operationCount = 0;

          for (const row of rows) {
            if (row.studentId && row.fullName && row.department && row.program) {
              const studentRef = doc(db, 'students', String(row.studentId).trim());
              currentBatch.set(studentRef, {
                studentId: String(row.studentId).trim(),
                fullName: String(row.fullName).trim(),
                department: String(row.department).trim(),
                program: String(row.program).trim(),
              });
              
              successCount++;
              operationCount++;

              if (operationCount === 490) {
                batches.push(currentBatch.commit());
                currentBatch = writeBatch(db);
                operationCount = 0;
              }
            } else {
              errorCount++;
            }
          }

          if (operationCount > 0) {
            batches.push(currentBatch.commit());
          }

          await Promise.all(batches);
          
          setUploadResult({
            success: successCount,
            errors: errorCount,
            message: `Successfully uploaded ${successCount} students. ${errorCount > 0 ? `Failed to parse ${errorCount} rows due to missing fields.` : ''}`
          });
          
          fetchLoadedStudents();
        } catch (error) {
          console.error('Error uploading students:', error);
          setUploadResult({
            success: 0,
            errors: rows.length,
            message: 'Failed to upload students. Please check your permissions and try again.'
          });
        } finally {
          setUploading(false);
          e.target.value = '';
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        setUploadResult({
          success: 0,
          errors: 1,
          message: 'Failed to parse CSV file. Please ensure it is correctly formatted.'
        });
        setUploading(false);
      }
    });
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLoadedStudents = loadedStudents.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (profile?.role !== 'ADMIN') {
    return <div className="p-8 text-center font-bold text-red-500">Unauthorized Access</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Records</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Manage and monitor all registered students.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all w-full sm:w-64"
              />
            </div>
            <button className="p-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('REGISTERED')}
            className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'REGISTERED' ? 'text-orange-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Registered Users
            {activeTab === 'REGISTERED' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('DATABASE')}
            className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'DATABASE' ? 'text-orange-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Pre-loaded Database
            {activeTab === 'DATABASE' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
            )}
          </button>
        </div>

        {activeTab === 'DATABASE' && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Upload size={20} className="text-orange-500" />
                Upload CSV
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Upload a CSV file to bulk import students for ID validation.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-500/20">
                <h3 className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase mb-2">Required CSV Headers:</h3>
                <code className="text-xs text-orange-600 dark:text-orange-300 font-mono block bg-white dark:bg-gray-900 p-2 rounded-lg border border-orange-100 dark:border-orange-500/20">
                  studentId,fullName,department,program
                </code>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                />
                <div className={`w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${uploading ? 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800' : 'border-orange-300 bg-orange-50/50 hover:bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/5 dark:hover:bg-orange-500/10'}`}>
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin text-gray-400" size={24} />
                      <span className="text-sm font-bold text-gray-500">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="text-orange-500" size={24} />
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-500">Select CSV File</span>
                    </>
                  )}
                </div>
              </div>

              {uploadResult && (
                <div className={`p-4 rounded-2xl flex items-start gap-3 ${uploadResult.success > 0 ? 'bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-400 border border-green-100 dark:border-green-500/20' : 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-400 border border-red-100 dark:border-red-500/20'}`}>
                  {uploadResult.success > 0 ? <CheckCircle size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
                  <p className="text-sm font-medium">{uploadResult.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
          <div className="overflow-x-auto w-full">
            {activeTab === 'REGISTERED' ? (
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Academic</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  <AnimatePresence>
                    {filteredStudents.map((student) => (
                      <motion.tr 
                        key={student.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/10 text-orange-600 rounded-xl flex items-center justify-center font-bold text-sm uppercase">
                              {student.fullName.substring(0, 2)}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-800 dark:text-white">{student.fullName}</div>
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Joined {student.createdAt?.toDate().toLocaleDateString()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <Mail size={12} />
                            {student.email}
                          </div>
                          {student.phoneNumber && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <Phone size={12} />
                              {student.phoneNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                            <GraduationCap size={14} className="text-orange-500" />
                            {student.department || 'Not Set'}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium ml-5">ID: {student.studentId || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-green-500 text-[10px] font-bold bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-full w-fit">
                            <div className="w-1 h-1 rounded-full bg-green-500" />
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button className="p-2 text-gray-400 hover:text-orange-500 transition-colors">
                              <Edit2 size={16} />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Student ID</th>
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Program</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  <AnimatePresence>
                    {filteredLoadedStudents.map((student) => (
                      <motion.tr 
                        key={student.studentId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                          {student.studentId}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                          {student.fullName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {student.department}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {student.program}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
          {((activeTab === 'REGISTERED' && filteredStudents.length === 0) || (activeTab === 'DATABASE' && filteredLoadedStudents.length === 0)) && !loading && (
            <div className="p-20 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto text-gray-300 dark:text-gray-600">
                <Users size={32} />
              </div>
              <p className="text-gray-400 dark:text-gray-500 font-medium">No students found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
