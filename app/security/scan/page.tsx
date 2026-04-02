'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ShieldCheck, AlertTriangle, CheckCircle2, UserCircle, Loader2 } from 'lucide-react';
import { verifyIDPayload } from '@/lib/qr';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function SecurityScannerPage() {
  const { profile } = useAuth();
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'SECURITY' && profile?.role !== 'ADMIN') return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);

    async function onScanSuccess(decodedText: string) {
      const result = verifyIDPayload(decodedText);
      const finalResult = result || { error: 'Invalid QR Code Signature' };
      setScanResult(finalResult);
      setScanning(false);
      scanner.clear();

      // Save scan to Firestore
      try {
        await addDoc(collection(db, 'scans'), {
          studentId: result?.s || 'N/A',
          studentName: result?.n || 'Unknown',
          scannedBy: profile?.uid,
          scannedAt: serverTimestamp(),
          status: result ? (result.expired ? 'EXPIRED' : 'VERIFIED') : 'INVALID'
        });
      } catch (error) {
        console.error("Error saving scan:", error);
      }
    }

    function onScanFailure(error: any) {
      // console.warn(`Code scan error = ${error}`);
    }

    return () => {
      scanner.clear().catch(e => console.error("Failed to clear scanner", e));
    };
  }, [profile]);

  if (profile?.role !== 'SECURITY' && profile?.role !== 'ADMIN') {
    return <div className="p-8 text-center font-bold text-red-500">Unauthorized Access</div>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Verification</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Scan student QR codes for instant verification.</p>
          </div>
          {!scanning && (
            <button 
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-500/20"
            >
              Scan Next
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 overflow-hidden">
            <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-orange-500" size={20} />
              Live Scanner
            </h2>
            <div id="reader" className="rounded-2xl overflow-hidden border-none bg-gray-50 dark:bg-gray-800"></div>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {!scanResult ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-12 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto text-gray-300 dark:text-gray-600">
                    <Loader2 className="animate-spin" size={32} />
                  </div>
                  <p className="text-gray-400 dark:text-gray-500 font-medium">Waiting for scan...</p>
                </motion.div>
              ) : scanResult.error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 dark:bg-red-500/10 rounded-3xl border border-red-100 dark:border-red-500/20 p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-red-900 dark:text-red-400">Verification Failed</h3>
                  <p className="text-red-700 dark:text-red-300 font-medium">{scanResult.error}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-3xl border p-8 space-y-6 ${scanResult.expired ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20' : 'bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${scanResult.expired ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-500' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-500'}`}>
                      {scanResult.expired ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${scanResult.expired ? 'bg-orange-200 dark:bg-orange-500/30 text-orange-800 dark:text-orange-300' : 'bg-green-200 dark:bg-green-500/30 text-green-800 dark:text-green-300'}`}>
                      {scanResult.expired ? 'Expired' : 'Verified'}
                    </span>
                  </div>

                  <div className="flex gap-6 items-center">
                    <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-200 dark:text-gray-600">
                      <UserCircle size={64} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{scanResult.n}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">ID: {scanResult.s}</p>
                      <p className={`text-xs font-bold ${scanResult.expired ? 'text-orange-600 dark:text-orange-500' : 'text-green-600 dark:text-green-500'}`}>
                        Expires: {new Date(scanResult.e).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50 grid grid-cols-2 gap-4">
                    <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Scan Time</div>
                      <div className="text-xs font-bold text-gray-800 dark:text-gray-300">{new Date().toLocaleTimeString()}</div>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Status</div>
                      <div className="text-xs font-bold text-gray-800 dark:text-gray-300">Authorized</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
