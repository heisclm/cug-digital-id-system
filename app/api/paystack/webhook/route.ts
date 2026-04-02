import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: Request) {
  const body = await req.text();
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex');

  if (hash !== req.headers.get('x-paystack-signature')) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === 'charge.success') {
    const { reference, metadata, amount, customer } = event.data;
    const { applicationId, studentUid } = metadata;

    // 1. Update Payment Record
    // 2. Update Application Status to APPROVED
    // 3. Generate ID Card Record
    
    // Note: In a real app, use Firebase Admin SDK here. 
    // For this demo, we'll assume the client-side handles the UI update, 
    // but the source of truth is this webhook.
    
    console.log(`Payment successful for application ${applicationId}`);
  }

  return new NextResponse('OK', { status: 200 });
}
