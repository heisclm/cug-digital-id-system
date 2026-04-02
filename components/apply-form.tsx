'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  const [submitting, setSubmitting] = useState(false);
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

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height,
      );

      return new Promise<File>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'passport_photo.jpg', { type: 'image/jpeg' });
          
          const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 800,
            useWebWorker: true,
          };
          
          try {
            const compressedFile = await imageCompression(file, options);
            resolve(compressedFile);
          } catch (error) {
            console.error('Compression error:', error);
            resolve(file);
          }
        }, 'image/jpeg');
      });
    }
  }, [completedCrop]);

  const handleCropComplete = async () => {
    const croppedFile = await getCroppedImg();
    if (croppedFile) {
      setPhoto(croppedFile);
      setPhotoPreview(URL.createObjectURL(croppedFile));
      setIsCropping(false);
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
      const photoRef = ref(storage, `photos/${profile?.uid}_${Date.now()}`);
      await uploadBytes(photoRef, photo);
      const photoUrl = await getDownloadURL(photoRef);

      await addDoc(collection(db, 'applications'), {
        ...data,
        studentUid: profile?.uid,
        photoUrl,
        status: 'PENDING',
        submittedAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => router.push('/'), 3000);
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
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
            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
            Submit Application
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 text-center">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Passport Photo</h2>
            <div className="relative aspect-square w-full bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center overflow-hidden group">
              {photoPreview ? (
                <Image 
                  src={photoPreview} 
                  alt="Preview" 
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
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
