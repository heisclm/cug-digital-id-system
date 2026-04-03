import { NextResponse } from 'next/server';
import { verifyIDPayload } from '@/lib/qr';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { qrString } = await req.json();

    if (!qrString) {
      return NextResponse.json({ error: 'Missing QR string' }, { status: 400 });
    }

    const verifiedData = verifyIDPayload(qrString);

    if (!verifiedData.valid) {
      return NextResponse.json({ error: verifiedData.error || 'Invalid QR Code signature' }, { status: 400 });
    }

    if (verifiedData.data.expired) {
      return NextResponse.json({ error: 'This ID card has expired.', expired: true }, { status: 400 });
    }

    // Double check with database to ensure it's not revoked
    const idCardsRef = adminDb.collection('id_cards');
    const snapshot = await idCardsRef
      .where('studentId', '==', verifiedData.data.s)
      .where('status', '==', 'ACTIVE')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'No active ID card found for this student in the database.' }, { status: 404 });
    }

    const idCardData = snapshot.docs[0].data();

    return NextResponse.json({
      verified: true,
      studentDetails: idCardData
    });

  } catch (error) {
    console.error('Verification API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
