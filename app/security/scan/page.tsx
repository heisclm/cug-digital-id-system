'use client';

import React, { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { Shield, QrCode, CheckCircle, XCircle, Loader2, User, AlertCircle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { verifyIDPayload } from '@/lib/qr';
import Image from 'next/image';

export default function SecurityScanPage() {
  const { profile } = useAuth();
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (profile?.role !== 'SECURITY' && profile?.role !== 'ADMIN') return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner", error));
    };
  }, [profile]);

  async function onScanSuccess(decodedText: string) {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setScanResult(null);
    setStudentDetails(null);

    try {
      const verifiedData = verifyIDPayload(decodedText);
      
      if (!verifiedData) {
        setError("Invalid QR Code signature. This ID may be forged.");
        await recordScan("INVALID", "Unknown");
        return;
      }

      if (verifiedData.expired) {
        setError("This ID card has expired.");
        await recordScan("EXPIRED", verifiedData.s);
        return;
      }

      // Fetch latest details from Firestore to ensure it's not revoked
      const q = query(
        collection(db, 'id_cards'),
        where('studentId', '==', verifiedData.s),
        where('status', '==', 'ACTIVE'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("No active ID card found for this student in the database.");
        await recordScan("INVALID", verifiedData.s);
        return;
      }

      const idCardData = querySnapshot.docs[0].data();
      setStudentDetails(idCardData);
      setScanResult("VERIFIED");
      await recordScan("VERIFIED", verifiedData.s);
      
      // Stop scanning once verified
      if (scannerRef.current) {
        // We don't necessarily want to stop, maybe just show a "Scan Next" button
        // scannerRef.current.pause();
      }

    } catch (err) {
      console.error("Scan processing error:", err);
      setError("Failed to process scan. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onScanFailure(error: any) {
    // console.warn(`Code scan error = ${error}`);
  }

  const recordScan = async (status: string, studentId: string) => {
    try {
      await addDoc(collection(db, 'scans'), {
        studentId,
        scannedBy: profile?.uid,
        scannedAt: serverTimestamp(),
        status,
      });
    } catch (err) {
      console.error("Error recording scan:", err);
    }
  };

  if (profile?.role !== 'SECURITY' && profile?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <AlertCircle size={48} className="text-red-500" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-gray-500">Only security personnel can access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="text-orange-500" />
              Security Verification
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Scan student QR codes to verify identity and campus access.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <QrCode size={20} className="text-orange-500" />
              Scanner
            </h2>
            <div id="reader" className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800"></div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-500 font-medium">
              Position the student&apos;s QR code within the frame to scan.
            </div>
          </div>

          <div className="space-y-6">
            {loading && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="animate-spin text-orange-500" size={48} />
                <p className="font-bold text-gray-500">Verifying ID...</p>
              </div>
            )}

            {!loading && !scanResult && !error && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-12 flex flex-col items-center justify-center text-center space-y-4">
                <QrCode size={64} className="text-gray-200 dark:text-gray-700" />
                <div>
                  <h3 className="font-bold text-gray-400">Waiting for Scan</h3>
                  <p className="text-sm text-gray-400">Scan a student ID card to see details.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 rounded-3xl border border-red-100 dark:border-red-500/20 p-8 space-y-4 text-center">
                <XCircle size={64} className="text-red-500 mx-auto" />
                <div>
                  <h3 className="text-xl font-bold text-red-600 dark:text-red-500">Verification Failed</h3>
                  <p className="text-red-500/80 font-medium">{error}</p>
                </div>
                <button 
                  onClick={() => { setError(null); setScanResult(null); }}
                  className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

            {scanResult === "VERIFIED" && studentDetails && (
              <div className="bg-green-50 dark:bg-green-500/10 rounded-3xl border border-green-100 dark:border-green-500/20 p-8 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <CheckCircle size={64} className="text-green-500" />
                  <div>
                    <h3 className="text-2xl font-bold text-green-600 dark:text-green-500">Access Granted</h3>
                    <p className="text-green-600/80 font-bold uppercase text-xs tracking-widest">Verified Student</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 flex gap-4 border border-green-100 dark:border-green-500/20 shadow-sm">
                  <div className="relative w-20 h-24 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800">
                    {studentDetails.photoUrl ? (
                      <Image 
                        src={studentDetails.photoUrl} 
                        alt="Student" 
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300"><User size={32} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-lg font-bold text-gray-900 dark:text-white truncate">{studentDetails.fullName}</div>
                    <div className="text-sm font-bold text-orange-500">{studentDetails.studentId}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{studentDetails.department}</div>
                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">
                      Expires: {studentDetails.expiryDate?.toDate().toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => { setScanResult(null); setStudentDetails(null); }}
                  className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
                >
                  Scan Next Student
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
