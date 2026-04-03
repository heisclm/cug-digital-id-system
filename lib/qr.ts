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
  graduationYear?: number;
}) {
  const payloadObj = {
    u: studentData.uid,
    s: studentData.studentId,
    n: studentData.fullName,
    e: studentData.expiryDate,
    y: studentData.graduationYear,
    t: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
  
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 16);
  
  return `${payload}.${signature}`;
}

export function verifyIDPayload(qrString: string): { valid: boolean; error?: string; data?: any } {
  const cleanQrString = qrString.trim();
  
  // Try new format first (dot separator)
  const lastDotIndex = cleanQrString.lastIndexOf('.');
  if (lastDotIndex !== -1) {
    const payload = cleanQrString.substring(0, lastDotIndex);
    const signature = cleanQrString.substring(lastDotIndex + 1);
    
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(payload)
      .digest('hex')
      .substring(0, 16);

    if (signature === expectedSignature) {
      try {
        const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        const expiry = new Date(data.e);
        if (expiry < new Date()) return { valid: false, error: "QR code expired", data: { ...data, expired: true } };
        return { valid: true, data: { ...data, expired: false } };
      } catch (e) {
        return { valid: false, error: "Payload parsing error" };
      }
    }
  }

  // Try old format (pipe separator)
  const [payload, signature] = cleanQrString.split('|');
  if (payload && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(payload)
      .digest('hex')
      .substring(0, 8);

    if (signature === expectedSignature) {
      try {
        const data = JSON.parse(payload);
        const expiry = new Date(data.e);
        if (expiry < new Date()) return { valid: false, error: "QR code expired", data: { ...data, expired: true } };
        return { valid: true, data: { ...data, expired: false } };
      } catch (e) {
        return { valid: false, error: "Payload parsing error" };
      }
    }
  }

  return { valid: false, error: "Invalid QR code signature or format" };
}
