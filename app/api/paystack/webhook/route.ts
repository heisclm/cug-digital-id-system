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
    let { applicationId, studentUid, studentId } = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    console.log('Webhook received:', { reference, applicationId, studentUid, studentId });

    if (!applicationId || !studentUid || !studentId) {
      console.error('Missing required metadata:', { applicationId, studentUid, studentId });
      return new NextResponse('Missing metadata', { status: 400 });
    }

    try {
      const paymentId = `pay_${reference}`;
      const appRef = adminDb.collection('applications').doc(applicationId);
      const paymentRef = adminDb.collection('payments').doc(paymentId);
      const userRef = adminDb.collection('users').doc(studentUid);
      
      // Use a transaction to ensure atomicity
      await adminDb.runTransaction(async (transaction) => {
        console.log('Starting transaction for payment:', reference);
        const paymentDoc = await transaction.get(paymentRef);
        if (paymentDoc.exists) {
          console.log(`Payment ${reference} already processed.`);
          return;
        }

        const appDoc = await transaction.get(appRef);
        if (!appDoc.exists) {
          console.error(`Application ${applicationId} not found in Firestore`);
          throw new Error(`Application ${applicationId} not found`);
        }

        const appData = appDoc.data();
        console.log('Found application data:', appData);
        
        if (appData?.studentUid !== studentUid) {
          console.error(`Unauthorized: Application studentUid (${appData?.studentUid}) != metadata studentUid (${studentUid})`);
          throw new Error(`Application ${applicationId} unauthorized access`);
        }

        // 1. Create Payment Record
        console.log('Setting payment record...');
        transaction.set(paymentRef, {
          id: paymentId,
          applicationId,
          studentUid,
          reference,
          amount: amount / 100,
          status: 'SUCCESSFUL',
          paidAt: FieldValue.serverTimestamp(),
        });

        // 2. Update Application Status
        console.log('Updating application status to PAID...');
        transaction.update(appRef, {
          status: 'PAID',
          paidAt: FieldValue.serverTimestamp(),
        });

        // 3. Generate ID Card
        console.log('Generating ID card payload...');
        const issueDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(issueDate.getFullYear() + 1);

        const qrPayload = generateIDPayload({
          uid: studentUid,
          studentId: studentId,
          fullName: appData?.fullName || 'N/A',
          expiryDate: expiryDate.toISOString(),
        });

        const idCardId = `id_${studentId}_${Date.now()}`;
        const idCardRef = adminDb.collection('id_cards').doc(idCardId);
        
        console.log('Creating ID card document:', idCardId);
        transaction.set(idCardRef, {
          id: idCardId,
          studentUid,
          studentId,
          applicationId,
          qrPayload: qrPayload,
          issueDate: FieldValue.serverTimestamp(),
          expiryDate: Timestamp.fromDate(expiryDate),
          status: 'ACTIVE',
          fullName: appData?.fullName,
          department: appData?.department,
          program: appData?.program,
          photoUrl: appData?.photoUrl,
        });

        // 4. Update User Status
        console.log('Updating user status to ACTIVE...');
        transaction.update(userRef, {
          status: 'ACTIVE',
          hasActiveId: true,
        });

        // 5. Create Notification
        console.log('Creating notification...');
        const notificationRef = adminDb.collection('notifications').doc();
        transaction.set(notificationRef, {
          userId: studentUid,
          title: 'ID Card Generated!',
          message: 'Your payment was successful and your digital ID card has been generated.',
          type: 'success',
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      console.log(`Successfully processed payment and generated ID for ${studentId}`);
    } catch (error: any) {
      console.error('Error processing webhook transaction:', error);
      // Return 500 so Paystack retries
      return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
    }
  }

  return new NextResponse('OK', { status: 200 });
}
