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
  
  console.log('Generated payload:', payload);
  console.log('Generated signature:', signature);
  
  return `${payload}.${signature}`;
}

export function verifyIDPayload(qrString: string) {
  const cleanQrString = qrString.trim();
  console.log('Verifying QR string:', cleanQrString);
  console.log('QR_SECRET length:', QR_SECRET.length);
  console.log('QR_SECRET prefix:', QR_SECRET.substring(0, 4) + '...');
  
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
        if (expiry < new Date()) return { ...data, expired: true };
        return { ...data, expired: false };
      } catch (e) {
        console.error('Error parsing payload:', e);
        return null;
      }
    } else {
        console.error('Signature mismatch (new format). Expected:', expectedSignature, 'Got:', signature);
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
        if (expiry < new Date()) return { ...data, expired: true };
        return { ...data, expired: false };
      } catch (e) {
        console.error('Error parsing payload:', e);
        return null;
      }
    } else {
        console.error('Signature mismatch (old format). Expected:', expectedSignature, 'Got:', signature);
    }
  }

  console.error('Signature mismatch or invalid format');
  return null;
}
