import { NextResponse } from 'next/server';
import { adminDb, FieldValue, Timestamp } from '@/lib/firebase-admin';
import { generateIDPayload } from '@/lib/qr';
import { calculateGraduationYear } from '@/lib/graduation';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: Request) {
  try {
    const { reference } = await req.json();

    if (!reference) {
      return new NextResponse('Missing reference', { status: 400 });
    }

    // Verify with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      return new NextResponse('Payment not successful', { status: 400 });
    }

    const { metadata, amount } = verifyData.data;
    let { applicationId, studentUid, studentId } = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;

    if (!applicationId || !studentUid || !studentId) {
      return new NextResponse('Missing metadata', { status: 400 });
    }

    const paymentId = `pay_${reference}`;
    const appRef = adminDb.collection('applications').doc(applicationId);
    const paymentRef = adminDb.collection('payments').doc(paymentId);
    const userRef = adminDb.collection('users').doc(studentUid);
    const studentRef = adminDb.collection('students').doc(studentId);
    
    let alreadyProcessed = false;

    // Use a transaction to ensure atomicity
    await adminDb.runTransaction(async (transaction) => {
      const paymentDoc = await transaction.get(paymentRef);
      if (paymentDoc.exists) {
        alreadyProcessed = true;
        return;
      }

      const appDoc = await transaction.get(appRef);
      if (!appDoc.exists) {
        throw new Error(`Application ${applicationId} not found`);
      }

      const studentDoc = await transaction.get(studentRef);
      const studentData = studentDoc.exists ? studentDoc.data() : {};

      const appData = appDoc.data();
      if (appData?.studentUid !== studentUid) {
        throw new Error(`Application ${applicationId} unauthorized access`);
      }

      // Calculate Graduation Year
      const graduationYear = calculateGraduationYear(studentData);
      const expiryDate = new Date(`${graduationYear}-12-31`);
      const isFinalYear = graduationYear === new Date().getFullYear();

      // 1. Create Payment Record
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
      transaction.update(appRef, {
        status: 'PAID',
        paidAt: FieldValue.serverTimestamp(),
      });

      // 3. Generate ID Card
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(issueDate.getFullYear() + 1);

      const qrPayload = generateIDPayload({
        uid: studentUid,
        studentId: studentId,
        fullName: appData?.fullName || 'N/A',
        expiryDate: expiryDate.toISOString(),
        graduationYear,
      });

      const idCardId = `id_${studentId}_${Date.now()}`;
      const idCardRef = adminDb.collection('id_cards').doc(idCardId);
      
      transaction.set(idCardRef, {
        id: idCardId,
        studentUid,
        studentId,
        applicationId,
        qrPayload: qrPayload,
        issueDate: FieldValue.serverTimestamp(),
        expiryDate: Timestamp.fromDate(expiryDate),
        graduationYear,
        isFinalYear,
        status: 'ACTIVE',
        fullName: appData?.fullName,
        department: appData?.department,
        program: appData?.program,
        photoUrl: appData?.photoUrl,
      });

      // 4. Update User Status
      transaction.update(userRef, {
        status: 'ACTIVE',
        hasActiveId: true,
      });

      // 5. Create Notification
      const notificationRef = adminDb.collection('notifications').doc();
      transaction.set(notificationRef, {
        userId: studentUid,
        title: 'ID Card Generated!',
        message: `Your payment was successful and your digital ID card has been generated. ${isFinalYear ? 'This is your final year!' : ''}`,
        type: 'success',
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    if (alreadyProcessed) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
