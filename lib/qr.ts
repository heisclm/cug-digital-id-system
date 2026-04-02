import crypto from 'crypto';

if (!process.env.QR_SECRET) {
  throw new Error("QR_SECRET is missing. Please set it in environment variables.");
}

const QR_SECRET = process.env.QR_SECRET;

export function generateIDPayload(studentData: {
  uid: string;
  studentId: string;
  fullName: string;
  expiryDate: string;
}) {
  const payload = JSON.stringify({
    u: studentData.uid,
    s: studentData.studentId,
    n: studentData.fullName,
    e: studentData.expiryDate,
    t: Date.now(),
  });

  // Simple HMAC for integrity check
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 8);

  return `${payload}|${signature}`;
}

export function verifyIDPayload(qrString: string) {
  const [payload, signature] = qrString.split('|');
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 8);

  if (signature !== expectedSignature) return null;

  try {
    const data = JSON.parse(payload);
    const expiry = new Date(data.e);
    if (expiry < new Date()) return { ...data, expired: true };
    return { ...data, expired: false };
  } catch {
    return null;
  }
}
