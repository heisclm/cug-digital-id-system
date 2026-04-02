import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { email, secret } = await req.json();

    if (!secret || secret !== process.env.ADMIN_SETUP_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!email) {
      return new NextResponse('Email is required', { status: 400 });
    }

    // Find user by email in Firestore
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return new NextResponse('User not found in Firestore', { status: 404 });
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      role: 'ADMIN',
      updatedAt: new Date(),
    });

    return NextResponse.json({
      message: `Successfully promoted ${email} to ADMIN`,
      uid: userDoc.id,
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
