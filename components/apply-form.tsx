'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Upload, CheckCircle, Loader2, CreditCard, X, Crop as CropIcon, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import imageCompression from 'browser-image-compression';

const schema = z.object({
  fullName: z.string().min(3, 'Full name is required'),
  studentId: z.string().min(5, 'Valid Student ID is required'),
  department: z.string().min(2, 'Department is required'),
  program: z.string().min(2, 'Program is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  type: z.enum(['NEW', 'RENEWAL']),
});

type FormData = z.infer<typeof schema>;

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export default function ApplyForm() {
  const { profile } = useAuth();
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [imgSrc, setImgSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile?.fullName || '',
      studentId: profile?.studentId || '',
      department: profile?.department || '',
      program: '',
      phoneNumber: profile?.phoneNumber || '',
      type: 'NEW',
    }
  });

  const studentIdValue = watch('studentId');

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || ''),
      );
      reader.readAsDataURL(e.target.files[0]);
      setIsCropping(true);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };

  const getCroppedImg = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;

    const targetSize = 400; // Slightly larger for better quality before compression
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Use better image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        targetSize,
        targetSize,
      );

      return new Promise<File>((resolve) => {
        // Native canvas compression is much faster than external libraries
        canvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], 'passport_photo.jpg', { type: 'image/jpeg' });
          resolve(file);
        }, 'image/jpeg', 0.7); // 0.7 quality at 400x400 is ~30-50KB
      });
    }
  }, [completedCrop]);

  const startBackgroundUpload = async (file: File) => {
    if (!profile?.uid) {
      console.error('No user profile found for upload');
      setUploadError(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setPhotoUrl(null);
    setUploadError(false);
    photoUrlRef.current = null;
    
    try {
      // Convert file to Base64 first (we'll use this as a fallback)
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result); // Full data URL
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const photoRef = ref(storage, `photos/${profile.uid}_${Date.now()}.jpg`);
      
      // Progress simulation
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      try {
        // Try Storage upload with a 15-second timeout
        const uploadPromise = uploadString(photoRef, base64Data.split(',')[1], 'base64', {
          contentType: 'image/jpeg',
          customMetadata: { uid: profile.uid }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Storage timeout')), 15000)
        );

        const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
        const url = await getDownloadURL(snapshot.ref);
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        setPhotoUrl(url);
        photoUrlRef.current = url;
        setIsUploading(false);
        return url;
      } catch (storageError) {
        console.warn('Firebase Storage failed or timed out, using Firestore fallback:', storageError);
        
        // FALLBACK: Use the Base64 data URL directly
        // This is extremely robust as it doesn't rely on the Storage service
        clearInterval(progressInterval);
        setUploadProgress(100);
        setPhotoUrl(base64Data);
        photoUrlRef.current = base64Data;
        setIsUploading(false);
        return base64Data;
      }
    } catch (error: any) {
      console.error('Upload initialization error:', error);
      setUploadError(true);
      setIsUploading(false);
      throw error;
    }
  };

  const handleCropComplete = async () => {
    const croppedFile = await getCroppedImg();
    if (croppedFile) {
      setPhoto(croppedFile);
      setPhotoPreview(URL.createObjectURL(croppedFile));
      setIsCropping(false);
      
      // Start background upload immediately after crop
      startBackgroundUpload(croppedFile);
    }
  };

  const validateStudentId = async () => {
    if (!studentIdValue || studentIdValue.length < 5) {
      setValidationError('Please enter a valid Student ID first.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setIsValidated(false);

    try {
      const studentDoc = await getDoc(doc(db, 'students', studentIdValue));
      
      if (!studentDoc.exists()) {
        setValidationError('Student ID not found in the database. Please contact administration.');
        setValue('fullName', '');
        setValue('department', '');
        setValue('program', '');
        return;
      }

      const appsQuery = query(collection(db, 'applications'), where('studentId', '==', studentIdValue), where('status', '==', 'PENDING'));
      const appsSnap = await getDocs(appsQuery);
      if (!appsSnap.empty) {
        setValidationError('An application is already pending for this Student ID.');
        return;
      }

      const idQuery = query(collection(db, 'id_cards'), where('studentUid', '==', profile?.uid), where('status', '==', 'ACTIVE'));
      const idSnap = await getDocs(idQuery);
      if (!idSnap.empty && watch('type') === 'NEW') {
        setValidationError('You already have an active ID. Please select RENEWAL if you need a new one.');
        return;
      }

      const data = studentDoc.data();
      setValue('fullName', data.fullName);
      setValue('department', data.department);
      setValue('program', data.program || 'N/A');
      setIsValidated(true);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationError('Failed to validate Student ID. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setValidationError(null);
    if (!isValidated) {
      setValidationError('Please verify your Student ID before submitting.');
      return;
    }

    if (!photo) {
      setValidationError('Please upload a passport photo to continue.');
      return;
    }

    setSubmitting(true);
    
    try {
      let finalPhotoUrl = photoUrlRef.current;

      // If background upload hasn't finished, wait for it
      if (!finalPhotoUrl) {
        setSubmitStep('uploading');
        
        // If it's not even uploading, start it now
        if (!isUploading) {
          finalPhotoUrl = await startBackgroundUpload(photo);
        } else {
          // Wait for photoUrlRef.current to be set (max 50 seconds to match 45s timeout)
          let attempts = 0;
          while (!photoUrlRef.current && attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            if (uploadError) throw new Error('Photo upload failed. Please retry the upload before submitting.');
          }
          finalPhotoUrl = photoUrlRef.current;
        }
        
        if (!finalPhotoUrl) {
          throw new Error('Photo upload timed out. Please try again.');
        }
      }

      setSubmitStep('saving');
      await addDoc(collection(db, 'applications'), {
        ...data,
        studentUid: profile?.uid,
        photoUrl: finalPhotoUrl,
        status: 'PENDING',
        submittedAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => router.push('/'), 2500);
    } catch (error: any) {
      console.error('Error submitting application:', error);
      setValidationError(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
      setSubmitStep('idle');
    }
  };

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto mt-20 text-center space-y-8 p-10 bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-gray-800"
      >
        <div className="relative w-32 h-32 mx-auto">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="w-full h-full bg-green-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-green-500/40"
          >
            <CheckCircle size={64} strokeWidth={3} />
          </motion.div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-green-500 rounded-full -z-10"
          />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Success!</h1>
          <p className="text-gray-500 dark:text-gray-400 font-bold text-lg leading-relaxed">
            Your application has been submitted successfully and is now under review.
          </p>
        </div>
        <div className="pt-4">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-orange-50 dark:bg-orange-500/10 rounded-2xl text-orange-600 dark:text-orange-400 font-black text-sm uppercase tracking-widest animate-pulse">
            <Loader2 className="animate-spin" size={18} strokeWidth={3} />
            Redirecting to dashboard
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Form Section */}
        <div className="lg:col-span-8 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-6 sm:p-10 shadow-2xl shadow-gray-200/50 dark:shadow-none space-y-10"
          >
            {/* Section 1: Identity */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-orange-500/30">1</div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Student Identity</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Student ID Number</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 group">
                      <input
                        {...register('studentId')}
                        placeholder="e.g. CUG12345"
                        readOnly={isValidated}
                        className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent rounded-2xl text-base font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all dark:text-white placeholder:text-gray-400 ${isValidated ? 'opacity-70 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800/80'}`}
                      />
                      {isValidated && (
                        <motion.div 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }} 
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                        >
                          <CheckCircle size={24} className="text-green-500" />
                        </motion.div>
                      )}
                    </div>
                    {isValidated ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsValidated(false);
                          setValue('fullName', '');
                          setValue('department', '');
                          setValue('program', '');
                        }}
                        className="px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2 shrink-0"
                      >
                        <X size={18} strokeWidth={3} /> Change
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={validateStudentId}
                        disabled={isValidating}
                        className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-black text-sm hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 shrink-0 active:scale-95"
                      >
                        {isValidating ? <Loader2 size={18} className="animate-spin" /> : 'Verify ID'}
                      </button>
                    )}
                  </div>
                  {validationError && <p className="text-xs text-red-500 font-bold mt-2 ml-1">{validationError}</p>}
                  {errors.studentId && !validationError && <p className="text-xs text-red-500 font-bold mt-2 ml-1">{errors.studentId.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input
                    {...register('fullName')}
                    readOnly
                    placeholder="Verified Name"
                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-gray-800/30 border-none rounded-2xl text-base font-bold text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Department</label>
                  <input
                    {...register('department')}
                    readOnly
                    placeholder="Verified Dept"
                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-gray-800/30 border-none rounded-2xl text-base font-bold text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Program</label>
                  <input
                    {...register('program')}
                    readOnly
                    placeholder="Verified Program"
                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-gray-800/30 border-none rounded-2xl text-base font-bold text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
                  <input
                    {...register('phoneNumber')}
                    placeholder="024 XXX XXXX"
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent rounded-2xl text-base font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all dark:text-white placeholder:text-gray-400"
                  />
                  {errors.phoneNumber && <p className="text-xs text-red-500 font-bold mt-2 ml-1">{errors.phoneNumber.message}</p>}
                </div>
              </div>
            </div>

            {/* Section 2: Application Details */}
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-orange-500/30">2</div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Application Type</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['NEW', 'RENEWAL'].map((type) => (
                  <label key={type} className="relative cursor-pointer group">
                    <input
                      type="radio"
                      {...register('type')}
                      value={type}
                      className="sr-only peer"
                    />
                    <div className="h-full px-6 py-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] border-2 border-transparent peer-checked:border-orange-500 peer-checked:bg-orange-50 dark:peer-checked:bg-orange-500/10 transition-all group-hover:bg-gray-100 dark:group-hover:bg-gray-800 active:scale-95">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all ${watch('type') === type ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                        {type === 'NEW' ? <CreditCard size={32} strokeWidth={2.5} /> : <Clock size={32} strokeWidth={2.5} />}
                      </div>
                      <div className={`font-black text-2xl transition-colors ${watch('type') === type ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {type} ID
                      </div>
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-[0.2em]">
                        {type === 'NEW' ? 'First time request' : 'Extend existing ID'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[2.5rem] font-black text-xl hover:shadow-2xl hover:shadow-orange-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-4 disabled:opacity-50 relative overflow-hidden group"
            >
              {submitting && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="absolute left-0 top-0 bottom-0 bg-orange-500/40 transition-all duration-300" 
                />
              )}
              <div className="flex items-center justify-center gap-3 relative z-10">
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={28} strokeWidth={3} />
                    <span className="tracking-tight">
                      {submitStep === 'uploading' ? `Uploading Photo (${uploadProgress}%)` : 'Saving Application...'}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={28} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                    <span className="tracking-tight text-2xl uppercase">Submit Application</span>
                  </>
                )}
              </div>
            </button>
          </motion.div>
        </div>

        {/* Sidebar Section: Photo Upload */}
        <div className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 space-y-8 text-center shadow-2xl shadow-gray-200/50 dark:shadow-none"
          >
            <div className="space-y-1">
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Passport Photo</h2>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Required for ID Card</p>
            </div>
            
            <div className="relative aspect-[3/4] w-full max-w-[280px] mx-auto bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center overflow-hidden group transition-all hover:border-orange-500/50">
              {photoPreview ? (
                <>
                  <Image 
                    src={photoPreview} 
                    alt="Preview" 
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-6 backdrop-blur-md">
                      <Loader2 className="animate-spin mb-4 text-orange-500" size={40} strokeWidth={3} />
                      <p className="text-sm font-black mb-1 uppercase tracking-tight">Processing</p>
                      <div className="w-full max-w-[120px] h-2 bg-white/20 rounded-full overflow-hidden mt-2">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" 
                        />
                      </div>
                      <p className="text-[10px] font-black mt-3 font-mono">{uploadProgress}%</p>
                    </div>
                  )}
                  {uploadError && (
                    <div className="absolute inset-0 bg-red-500/95 flex flex-col items-center justify-center text-white p-6 text-center backdrop-blur-md">
                      <X className="mb-3 text-white" size={40} strokeWidth={3} />
                      <p className="text-sm font-black mb-2 uppercase">Upload Failed</p>
                      <div className="flex flex-col gap-2 w-full">
                        <button 
                          type="button"
                          onClick={() => photo && startBackgroundUpload(photo)}
                          className="w-full py-3 bg-white text-red-600 rounded-xl text-xs font-black hover:bg-gray-100 transition-all shadow-xl uppercase"
                        >
                          Retry
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setUploadError(false);
                            setIsUploading(false);
                            setPhotoPreview(null);
                            setPhoto(null);
                          }}
                          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition-all uppercase"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 p-6">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-[2rem] flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-500 shadow-inner">
                    <Upload size={40} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-black text-gray-800 dark:text-white uppercase tracking-tight">Upload Photo</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Click or drag & drop</p>
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onSelectFile}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              {photoPreview && !isUploading && !uploadError && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/30">
                    <p className="text-white text-xs font-black uppercase tracking-widest">Change Photo</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-[1.5rem] text-center">
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Max Size</p>
                  <p className="text-sm font-black text-gray-700 dark:text-gray-300">2.0 MB</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-[1.5rem] text-center">
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Format</p>
                  <p className="text-sm font-black text-gray-700 dark:text-gray-300">JPG/PNG</p>
                </div>
              </div>
              <ul className="text-[11px] text-gray-400 dark:text-gray-500 text-left space-y-3 font-bold uppercase tracking-wider px-2">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> White background</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> Face clearly visible</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> No hats/sunglasses</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </form>

      {isCropping && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
                  <CropIcon size={24} className="text-orange-500" strokeWidth={3} />
                  CROP PHOTO
                </h3>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Adjust your passport photo</p>
              </div>
              <button 
                onClick={() => setIsCropping(false)}
                className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all active:scale-90"
              >
                <X size={24} className="text-gray-500" strokeWidth={3} />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center gap-8">
              <div className="max-h-[50vh] overflow-auto rounded-[2rem] border-4 border-gray-100 dark:border-gray-800 shadow-inner bg-gray-50 dark:bg-gray-800">
                {!!imgSrc && (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    circularCrop
                  >
                    <Image
                      ref={imgRef}
                      alt="Crop me"
                      src={imgSrc}
                      onLoad={onImageLoad}
                      className="max-w-full"
                      width={800}
                      height={600}
                      unoptimized
                    />
                  </ReactCrop>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  onClick={() => setIsCropping(false)}
                  className="flex-1 py-5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropComplete}
                  className="flex-1 py-5 bg-orange-500 text-white rounded-2xl font-black text-sm hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/30 uppercase tracking-widest active:scale-95"
                >
                  Apply Crop
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
