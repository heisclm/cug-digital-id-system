# 🎓 CUG Digital ID System

A modern, secure, and highly scalable digital identification platform built for the Catholic University of Ghana (CUG). This system transitions the university from physical ID cards to a unified digital ecosystem, enabling students to apply, pay, and access their IDs dynamically while giving security personnel real-time verification tools.

---

## 🚀 Key Features

### 🔐 Role-Based Access Control (RBAC)
- **Students**: Apply for new/renewal IDs, process payments, and access active digital IDs with dynamically generated QR codes.
- **Administrators**: Review applications, manage the centralized student database, and oversee the payment pipeline.
- **Security Personnel**: Access dedicated scanning modules to verify digital IDs in real-time.

### 🛡️ Cryptographically Secure QR Codes
- QR payloads are protected against forgery using **HMAC-SHA256 signatures**. 
- Scanners verify the payload integrity locally before querying the database, ensuring zero-trust verification of expiry dates and student identity.

### 💳 Automated Payment Pipeline
- Integrated **Paystack Webhooks** for seamless application fee processing.
- Listens for `charge.success` events to automatically update payment records and trigger application approval workflows.

### ⚡ Real-Time Infrastructure
- Fully reactive UI powered by **Firebase Firestore** `onSnapshot` listeners.
- Real-time in-app notification system alerts students of application status changes and successful registrations.
- Pre-validation logic checks applicant IDs against a pre-loaded university database before allowing application submission.

---

## 💻 Tech Stack

**Frontend Architecture:**
- **Framework**: Next.js 15 (App Router)
- **Library**: React 19
- **Styling**: Tailwind CSS v4, PostCSS, Framer Motion
- **Form Management**: React Hook Form with Zod schema validation
- **QR Utilities**: `qrcode.react`, `html5-qrcode`

**Backend & Cloud Infrastructure:**
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth (Email/Password & Google OAuth)
- **Storage**: Firebase Storage (Passport photo uploads)
- **Payments**: Paystack API
- **AI Integrations**: Google Gemini API (`@google/genai`)

---

## ⚙️ System Architecture & Data Flow

1. **Validation Phase**: A user inputs their Student ID. The system queries the `students` Firestore collection to verify enrollment and auto-fills data.
2. **Application Phase**: The user uploads a passport photo (saved to Firebase Storage) and submits the application form (saved to `applications` collection).
3. **Checkout Phase**: A Paystack transaction is initialized. Upon success, the Paystack Webhook (`/api/paystack/webhook/route.ts`) cryptographically verifies the event signature and updates the backend.
4. **Issuance**: Once approved, an active `id_card` record is generated.
5. **Verification**: Security scans the ID's QR code. The payload is split, re-hashed with the server secret, and checked for authenticity and expiry.

---

## 🛠️ Local Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- A Firebase Project (with Auth, Firestore, and Storage enabled)
- A Paystack Account

### 1. Clone & Install
```bash
git clone [https://github.com/yourusername/cug-digital-id-system.git](https://github.com/yourusername/cug-digital-id-system.git)
cd cug-digital-id-system
npm install
