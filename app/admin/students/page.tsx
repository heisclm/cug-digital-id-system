'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { Upload, CheckCircle, Loader2, Users, AlertCircle } from 'lucide-react';

export default function AdminStudentsPage() {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileData, setFileData] = useState<any[] | null>(null);

  if (profile?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <AlertCircle size={48} className="text-red-500" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-gray-500">You do not have permission to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setFileData(json);
          setError(null);
        } else {
          setError('Invalid format. Please upload a JSON array of students.');
        }
      } catch (err) {
        setError('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!fileData) return;

    setUploading(true);
    setError(null);
    try {
      // Use batches for efficiency (max 500 per batch)
      const batchSize = 500;
      for (let i = 0; i < fileData.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = fileData.slice(i, i + batchSize);
        
        chunk.forEach((student) => {
          if (student.studentId) {
            const studentRef = doc(db, 'students', student.studentId);
            batch.set(studentRef, {
              ...student,
              updatedAt: new Date(),
            }, { merge: true });
          }
        });
        
        await batch.commit();
      }
      
      setSuccess(true);
      setFileData(null);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload student data. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-orange-500" />
            Manage Student Database
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Upload student records to allow them to apply for ID cards.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Upload Student JSON</h2>
            <p className="text-sm text-gray-500">
              Format: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{`[{"studentId": "12345", "fullName": "John Doe", "department": "Science", "program": "BSc"}]`}</code>
            </p>
            
            <div className="relative h-40 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center group hover:border-orange-500 transition-all">
              <Upload className="text-gray-300 group-hover:text-orange-500 mb-2" size={32} />
              <p className="text-sm font-medium text-gray-500">Click to select JSON file</p>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl text-sm font-medium flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {fileData && (
              <div className="p-4 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-xl text-sm font-medium">
                Found {fileData.length} student records. Ready to upload.
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 rounded-xl text-sm font-medium flex items-center gap-2">
                <CheckCircle size={16} />
                Student database updated successfully!
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!fileData || uploading}
              className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
              Upload Records
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
