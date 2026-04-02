import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb, FieldValue, Timestamp } from '@/lib/firebase-admin';
import QRCode from 'qrcode';
import { generateIDPayload } from '@/lib/qr';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-paystack-signature');
  
  if (!signature) {
    return new NextResponse('Missing signature', { status: 401 });
  }

  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex');

  if (hash !== signature) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === 'charge.success') {
    const { reference, metadata, amount } = event.data;
    const { applicationId, studentUid, studentId } = metadata;

    try {
      // 0. Check for Idempotency
      const paymentId = `pay_${reference}`;
      const existingPayment = await adminDb.collection('payments').doc(paymentId).get();
      if (existingPayment.exists) {
        console.log(`Payment ${reference} already processed. Skipping.`);
        return new NextResponse('Already processed', { status: 200 });
      }

      // 1. Verify application exists and is pending
      const appRef = adminDb.collection('applications').doc(applicationId);
      const appDoc = await appRef.get();

      if (!appDoc.exists) {
        console.error(`Application ${applicationId} not found`);
        return new NextResponse('Application not found', { status: 404 });
      }

      const appData = appDoc.data();
      
      // Extra Security: Ensure the application belongs to the studentUid
      if (appData?.studentUid !== studentUid) {
        console.error(`Application ${applicationId} does not belong to student ${studentUid}`);
        return new NextResponse('Unauthorized application access', { status: 403 });
      }

      // 2. Create Payment Record
      await adminDb.collection('payments').doc(paymentId).set({
        id: paymentId,
        applicationId,
        studentUid,
        reference,
        amount: amount / 100, // Convert from kobo/pesewas
        status: 'SUCCESSFUL',
        paidAt: FieldValue.serverTimestamp(),
      });

      // 3. Update Application Status
      await appRef.update({
        status: 'PAID',
        paidAt: FieldValue.serverTimestamp(),
      });

      // 4. Generate ID Card
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(issueDate.getFullYear() + 1); // 1 year validity

      const qrPayload = generateIDPayload({
        uid: studentUid,
        studentId: studentId,
        fullName: appData?.fullName || 'N/A',
        expiryDate: expiryDate.toISOString(),
      });

      // OPTIMIZATION: Store only the QR payload string, not the Base64 image
      const idCardId = `id_${studentId}_${Date.now()}`;
      await adminDb.collection('id_cards').doc(idCardId).set({
        id: idCardId,
        studentUid,
        studentId,
        applicationId,
        qrPayload: qrPayload, // Store the raw payload string
        issueDate: FieldValue.serverTimestamp(),
        expiryDate: Timestamp.fromDate(expiryDate),
        status: 'ACTIVE',
        fullName: appData?.fullName,
        department: appData?.department,
        program: appData?.program,
        photoUrl: appData?.photoUrl,
      });

      // 5. Update User/Student Status if needed
      await adminDb.collection('users').doc(studentUid).update({
        status: 'ACTIVE',
        hasActiveId: true,
      });

      // 6. Create Notification
      await adminDb.collection('notifications').add({
        userId: studentUid,
        title: 'ID Card Generated!',
        message: 'Your payment was successful and your digital ID card has been generated. You can now view it in your dashboard.',
        type: 'success',
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(`Successfully processed payment and generated ID for ${studentId}`);
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  }

  return new NextResponse('OK', { status: 200 });
}
