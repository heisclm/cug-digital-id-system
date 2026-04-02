'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, CheckCircle, Loader2, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { sendNotification } from '@/lib/notifications';

const schema = z.object({
  fullName: z.string().min(3, 'Full name is required'),
  studentId: z.string().min(5, 'Valid Student ID is required'),
  department: z.string().min(2, 'Department is required'),
  program: z.string().min(2, 'Program is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  type: z.enum(['NEW', 'RENEWAL']),
});

type FormData = z.infer<typeof schema>;

export default function ApplyPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
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
      // 1. Check if student exists in the pre-loaded database
      const studentDoc = await getDoc(doc(db, 'students', studentIdValue));
      
      if (!studentDoc.exists()) {
        setValidationError('Student ID not found in the database. Please contact administration.');
        // Clear fields
        setValue('fullName', '');
        setValue('department', '');
        setValue('program', '');
        return;
      }

      // 2. Check if student already has a pending application or active ID
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

      // 3. Auto-fill data
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
      // 1. Upload Photo
      const photoRef = ref(storage, `photos/${profile?.uid}_${Date.now()}`);
      await uploadBytes(photoRef, photo);
      const photoUrl = await getDownloadURL(photoRef);

      // 2. Create Application
      await addDoc(collection(db, 'applications'), {
        ...data,
        studentUid: profile?.uid,
        photoUrl,
        status: 'PENDING',
        submittedAt: serverTimestamp(),
      });

      // Send notification
      await sendNotification(
        profile?.uid!,
        'Application Submitted',
        `Your ${data.type} ID card application has been successfully submitted and is under review.`,
        'info'
      );

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
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ID Card Application</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Fill in the details below to request your digital ID.</p>
        </div>

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
                  onChange={handlePhotoChange}
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
      </div>
    </DashboardLayout>
  );
}
