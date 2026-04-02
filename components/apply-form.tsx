'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Upload, CheckCircle, Loader2, CreditCard, X, Crop as CropIcon } from 'lucide-react';
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
    if (!isValidated) {
      alert('Please validate your Student ID before submitting.');
      return;
    }

    if (!photo) {
      alert('Please upload a passport photo');
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
      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      console.error('Error submitting application:', error);
      const message = error.message || 'Failed to submit application. Please try again.';
      alert(message);
    } finally {
      setSubmitting(false);
      setSubmitStep('idle');
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Application Submitted!</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Your application is being reviewed. You will be notified once it&apos;s approved for payment.
        </p>
        <div className="animate-pulse text-orange-500 font-bold">Redirecting to dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Student ID</label>
              <div className="flex gap-2">
                <input
                  {...register('studentId')}
                  readOnly={isValidated}
                  className={`flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 dark:text-white ${isValidated ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
                {isValidated ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsValidated(false);
                      setValue('fullName', '');
                      setValue('department', '');
                      setValue('program', '');
                    }}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                  >
                    Change
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={validateStudentId}
                    disabled={isValidating}
                    className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isValidating ? <Loader2 size={16} className="animate-spin" /> : 'Validate'}
                  </button>
                )}
              </div>
              {validationError && <p className="text-xs text-red-500 font-medium">{validationError}</p>}
              {isValidated && <p className="text-xs text-green-500 font-medium flex items-center gap-1"><CheckCircle size={12} /> Student ID verified</p>}
              {errors.studentId && !validationError && <p className="text-xs text-red-500 font-medium">{errors.studentId.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Full Name</label>
              <input
                {...register('fullName')}
                readOnly
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 dark:text-white opacity-70 cursor-not-allowed"
              />
              {errors.fullName && <p className="text-xs text-red-500 font-medium">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Department</label>
              <input
                {...register('department')}
                readOnly
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 dark:text-white opacity-70 cursor-not-allowed"
              />
              {errors.department && <p className="text-xs text-red-500 font-medium">{errors.department.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Program</label>
              <input
                {...register('program')}
                readOnly
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 dark:text-white opacity-70 cursor-not-allowed"
              />
              {errors.program && <p className="text-xs text-red-500 font-medium">{errors.program.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Phone Number</label>
              <input
                {...register('phoneNumber')}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 dark:text-white"
              />
              {errors.phoneNumber && <p className="text-xs text-red-500 font-medium">{errors.phoneNumber.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Application Type</label>
            <div className="flex gap-4">
              {['NEW', 'RENEWAL'].map((type) => (
                <label key={type} className="flex-1 cursor-pointer group">
                  <input
                    type="radio"
                    {...register('type')}
                    value={type}
                    className="sr-only peer"
                  />
                  <div className="px-4 py-3 text-center bg-gray-50 dark:bg-gray-800 rounded-xl font-bold text-sm text-gray-500 dark:text-gray-400 peer-checked:bg-orange-500 peer-checked:text-white transition-all">
                    {type} ID
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 relative overflow-hidden"
          >
            {submitting && (
              <div 
                className="absolute left-0 top-0 bottom-0 bg-orange-500/20 transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            )}
            <div className="flex items-center justify-center gap-3 relative z-10">
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {submitStep === 'uploading' ? `Uploading Photo (${uploadProgress}%)` : 'Saving Application...'}
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  Submit Application
                </>
              )}
            </div>
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 text-center">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Passport Photo</h2>
            <div className="relative aspect-square w-full bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center overflow-hidden group">
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
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-6 backdrop-blur-sm">
                      <Loader2 className="animate-spin mb-3 text-orange-500" size={32} />
                      <p className="text-sm font-bold mb-1">Processing Photo</p>
                      <p className="text-[10px] opacity-70 mb-3 text-center">Finalizing your ID photo...</p>
                      <div className="w-full max-w-[140px] h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all duration-300 ease-out" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-mono mt-2">{uploadProgress}%</p>
                    </div>
                  )}
                  {uploadError && (
                    <div className="absolute inset-0 bg-red-500/90 flex flex-col items-center justify-center text-white p-4 text-center backdrop-blur-sm">
                      <X className="mb-2 text-white" size={32} />
                      <p className="text-sm font-bold mb-1">Upload Failed</p>
                      <p className="text-[10px] opacity-90 mb-4">Connection timed out or interrupted.</p>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setUploadError(false);
                            setIsUploading(false);
                            setPhotoPreview(null);
                            setPhoto(null);
                          }}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          type="button"
                          onClick={() => photo && startBackgroundUpload(photo)}
                          className="px-4 py-1.5 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all shadow-lg"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Upload className="text-gray-300 dark:text-gray-600 mb-2" size={48} />
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium px-4">Click to upload passport photo</p>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onSelectFile}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {photoPreview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-xs font-bold">Change Photo</p>
                </div>
              )}
            </div>
            <ul className="text-[10px] text-gray-400 dark:text-gray-500 text-left space-y-1 font-medium">
              <li>• White background preferred</li>
              <li>• Face must be clearly visible</li>
              <li>• No hats or sunglasses</li>
              <li>• Max size: 2MB</li>
            </ul>
          </div>
        </div>
      </form>

      {isCropping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CropIcon size={20} className="text-orange-500" />
                Crop Passport Photo
              </h3>
              <button 
                onClick={() => setIsCropping(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="max-h-[50vh] overflow-auto rounded-2xl border border-gray-100 dark:border-gray-800">
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
              
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setIsCropping(false)}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropComplete}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                >
                  Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
