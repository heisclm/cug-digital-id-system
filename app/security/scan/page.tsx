'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  Shield, 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  User, 
  AlertCircle, 
  Camera, 
  RefreshCw, 
  Image as ImageIcon,
  History,
  Info
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';

export default function SecurityScanPage() {
  const { profile } = useAuth();
  const [scanResult, setScanResult] = useState<'VERIFIED' | 'FAILED' | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch recent scans
  useEffect(() => {
    if (!profile?.uid) return;
    
    const fetchRecentScans = async () => {
      try {
        const q = query(
          collection(db, 'scans'),
          where('scannedBy', '==', profile.uid),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const scans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentScans(scans);
      } catch (err) {
        console.error("Error fetching recent scans:", err);
      }
    };

    fetchRecentScans();
  }, [profile?.uid]);

  const recordScan = useCallback(async (status: string, studentId: string) => {
    try {
      const scanData = {
        studentId,
        scannedBy: profile?.uid,
        scannedByEmail: profile?.email,
        scannedAt: serverTimestamp(),
        status,
      };
      await addDoc(collection(db, 'scans'), scanData);
      
      // Update local recent scans
      setRecentScans(prev => [{ id: Date.now().toString(), ...scanData }, ...prev.slice(0, 4)]);
    } catch (err) {
      console.error("Error recording scan:", err);
    }
  }, [profile?.uid, profile?.email]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  }, []);

  const onScanSuccess = useCallback(async (decodedText: string) => {
    // Prevent multiple simultaneous scans
    if (loading) return;
    
    // Stop scanner to focus on result
    await stopScanner();
    
    setLoading(true);
    setError(null);
    setScanResult(null);
    setStudentDetails(null);

    try {
      // Call the server-side verification API
      const response = await fetch('/api/security/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrString: decodedText }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to verify ID.");
        setScanResult('FAILED');
        
        // Extract student ID from QR if possible for logging
        let studentId = "Unknown";
        try {
          const [payload] = decodedText.split('|');
          if (payload) {
            const parsed = JSON.parse(payload);
            studentId = parsed.s || "Unknown";
          }
        } catch (e) {}
        
        await recordScan(data.expired ? "EXPIRED" : "INVALID", studentId);
        return;
      }

      setStudentDetails(data.studentDetails);
      setScanResult("VERIFIED");
      await recordScan("VERIFIED", data.studentDetails.studentId);

    } catch (err) {
      console.error("Scan processing error:", err);
      setError("Failed to process scan. Please try again.");
      setScanResult('FAILED');
    } finally {
      setLoading(false);
    }
  }, [loading, stopScanner, recordScan]);

  const onScanFailure = useCallback((error: any) => {
    // Silent failure for continuous scanning
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;
    setCameraError(null);
    setIsScanning(true);

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err: any) {
      console.error("Camera start error:", err);
      setCameraError("Unable to access camera. Please check permissions.");
      setIsScanning(false);
    }
  }, [onScanSuccess, onScanFailure]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    
    try {
      const html5QrCode = new Html5Qrcode("reader");
      const result = await html5QrCode.scanFile(file, true);
      onScanSuccess(result);
    } catch (err) {
      console.error("File scan error:", err);
      setError("No QR code found in the image.");
      setLoading(false);
    }
  }, [onScanSuccess]);

  if (profile?.role !== 'SECURITY' && profile?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <AlertCircle size={64} className="text-red-500" />
          </motion.div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-gray-500">Only security personnel can access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="space-y-1"
          >
            <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
                <Shield className="text-white" size={24} />
              </div>
              Security <span className="text-orange-500">Verification</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Real-time student identity verification system.</p>
          </motion.div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all"
            >
              <ImageIcon size={18} />
              Scan Image
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Scanner Section */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-xl shadow-gray-200/50 dark:shadow-none relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <Camera size={24} className="text-orange-500" />
                  Live Scanner
                </h2>
                {isScanning && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Active
                  </div>
                )}
              </div>

              <div className="relative aspect-square md:aspect-video bg-black rounded-3xl overflow-hidden group">
                <div id="reader" className="w-full h-full"></div>
                
                {!isScanning && !loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10 p-8 text-center">
                    {cameraError ? (
                      <>
                        <AlertCircle size={48} className="text-red-500 mb-4" />
                        <h3 className="text-white font-bold text-lg mb-2">Camera Error</h3>
                        <p className="text-gray-400 text-sm mb-6">{cameraError}</p>
                      </>
                    ) : (
                      <>
                        <QrCode size={64} className="text-orange-500 mb-4 opacity-50" />
                        <h3 className="text-white font-bold text-lg mb-2">Scanner Paused</h3>
                        <p className="text-gray-400 text-sm mb-6">Ready to verify the next student ID.</p>
                      </>
                    )}
                    <button 
                      onClick={startScanner}
                      className="px-8 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/30"
                    >
                      <RefreshCw size={20} />
                      {cameraError ? "Retry Camera" : "Start Scanner"}
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-20">
                    <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                    <p className="font-black text-gray-900 dark:text-white">VERIFYING IDENTITY...</p>
                  </div>
                )}

                {/* Scanner Overlay Frame */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-orange-500/50 rounded-3xl">
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-xl"></div>
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-xl"></div>
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-xl"></div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-xl"></div>
                      
                      {/* Scanning Line */}
                      <motion.div 
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)] z-20"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-500/5 rounded-2xl border border-blue-100 dark:border-blue-500/10">
                <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
                  The scanner automatically verifies the digital signature of the ID. Ensure the student&apos;s screen brightness is high for better scanning.
                </p>
              </div>
            </motion.div>

            {/* Recent Scans */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8"
            >
              <h3 className="text-lg font-black flex items-center gap-2 mb-6">
                <History size={20} className="text-gray-400" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {recentScans.length > 0 ? (
                  recentScans.map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          scan.status === 'VERIFIED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {scan.status === 'VERIFIED' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{scan.studentId}</p>
                          <p className="text-[10px] text-gray-500 font-medium">
                            {scan.scannedAt?.toDate ? scan.scannedAt.toDate().toLocaleTimeString() : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${
                        scan.status === 'VERIFIED' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                      }`}>
                        {scan.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-gray-400 text-sm font-medium italic">No recent scans recorded.</p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Result Section */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              {!scanResult && !error && !loading && (
                <motion.div 
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-12 h-full flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500 blur-3xl opacity-10 animate-pulse"></div>
                    <QrCode size={80} className="text-gray-200 dark:text-gray-800 relative z-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-400">Ready to Scan</h3>
                    <p className="text-sm text-gray-400 max-w-[200px] mx-auto mt-2">Position a student ID card in front of the camera to begin verification.</p>
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-red-50 dark:bg-red-500/5 rounded-[2.5rem] border border-red-100 dark:border-red-500/10 p-10 space-y-8 text-center sticky top-8"
                >
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20"></div>
                    <XCircle size={80} className="text-red-500 relative z-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-red-600 dark:text-red-500">Verification Failed</h3>
                    <p className="text-red-500/80 font-bold text-sm leading-relaxed">{error}</p>
                  </div>
                  <button 
                    onClick={() => { setError(null); setScanResult(null); startScanner(); }}
                    className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                  >
                    RETRY SCAN
                  </button>
                </motion.div>
              )}

              {scanResult === "VERIFIED" && studentDetails && (
                <motion.div 
                  key="verified"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-green-50 dark:bg-green-500/5 rounded-[2.5rem] border border-green-100 dark:border-green-500/10 p-8 space-y-8 sticky top-8"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20"></div>
                      <CheckCircle size={80} className="text-green-500 relative z-10" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-green-600 dark:text-green-500 italic">ACCESS GRANTED</h3>
                      <p className="text-green-600/60 font-black uppercase text-[10px] tracking-[0.2em] mt-1">Identity Confirmed</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 space-y-6 border border-green-100 dark:border-green-500/10 shadow-xl shadow-green-500/5">
                    <div className="flex gap-6">
                      <div className="relative w-28 h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800">
                        {studentDetails.photoUrl ? (
                          <Image 
                            src={studentDetails.photoUrl} 
                            alt="Student" 
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-300"><User size={40} /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                        <div className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{studentDetails.fullName}</div>
                        <div className="text-lg font-black text-orange-500">{studentDetails.studentId}</div>
                        <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 inline-block w-fit">
                          {studentDetails.department}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Program</p>
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{studentDetails.program}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Expiry</p>
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 text-right">
                          {studentDetails.expiryDate?.toDate ? studentDetails.expiryDate.toDate().toLocaleDateString() : studentDetails.expiryDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => { setScanResult(null); setStudentDetails(null); startScanner(); }}
                    className="w-full py-5 bg-green-500 text-white rounded-2xl font-black text-lg hover:bg-green-600 transition-all shadow-xl shadow-green-500/20 flex items-center justify-center gap-3"
                  >
                    <RefreshCw size={24} />
                    SCAN NEXT
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
