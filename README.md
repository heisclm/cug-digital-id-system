Perfect — this is exactly how you level up your project 🔥
Now let’s turn Gemini’s feedback into a **powerful FIX prompt** for Google AI Studio.

---

# 🚀 SECURITY + SYSTEM FIX PROMPT (Copy & Paste)

**Prompt:**

Audit and fix the Smart ID Card Management System based on the following detected issues. Improve security, architecture, and missing functionality to production level.

---

## 🔴 CRITICAL: Fix Security Issues First

### 1. ❌ Remove Hardcoded Admin Email

* Remove any hardcoded admin email (e.g., `feraclem@gmail.com`) from:

  * auth-context
  * Firestore rules

### ✅ Replace with:

* Role-based system using:

  * Firestore `role` field OR
  * Firebase Custom Claims (preferred)

### Implement:

* Admin role assignment system
* Secure role checking (no client-side trust)

---

### 2. ❌ Fix Firestore Notification Security

Current issue:

* Any authenticated user can create notifications

### ✅ Fix:

* Only allow:

  * Admins OR
  * Backend system (API routes)

### Update Firestore rules:

* Block users from creating arbitrary notifications
* Users can only:

  * Read their own notifications
  * Update `isRead` field only

---

### 3. ❌ Fix Paystack Webhook (IMPORTANT)

Current issue:

* Webhook only logs data (not useful)

### ✅ Fix:

* Implement real webhook logic using **Firebase Admin SDK**

Webhook should:

* Verify Paystack transaction
* Update Firestore:

  * Mark payment as successful
  * Update ID application status
  * Trigger ID card generation
  * Create notification

---

## 🧱 ARCHITECTURE IMPROVEMENTS

### 4. ✅ Setup Firebase Admin SDK

* Create secure backend (Next.js API route)
* Use Admin SDK for:

  * Writing sensitive data
  * Updating roles
  * Handling payments

---

### 5. ❌ Fix Firebase Config Exposure

Current issue:

* Config stored in JSON file

### ✅ Fix:

* Move all config to `.env.local`

Example:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
```

* Update code to use `process.env`

---

## ⚙️ MISSING CORE FEATURE

### 6. ❌ Implement ID Card Generation Logic

Currently missing after payment

### ✅ Implement:

When:

* Payment is successful

System should:

1. Generate ID card
2. Create QR code
3. Save ID data in Firestore
4. Update student status → “ACTIVE”
5. Notify user

---

## 🔐 SECURITY UPGRADES

* Validate all sensitive actions in backend (not frontend)
* Prevent duplicate student IDs
* Add proper error handling
* Sanitize all inputs

---

## 🎨 UI/UX IMPROVEMENTS

### 7. Add Image Cropper

* Use library like:

  * react-image-crop
* Ensure:

  * Passport photos are uniform (e.g., 1:1 ratio)

---

### 8. Add Image Compression

* Use:

  * browser-image-compression
* Compress before upload to Firebase Storage

---

## ⚡ PERFORMANCE IMPROVEMENTS

* Optimize Firebase queries
* Reduce unnecessary re-renders
* Lazy load components where needed

---

## 📂 OUTPUT REQUIREMENTS

After fixing everything:

1. Show updated folder structure
2. Show updated Firestore rules
3. Show secure webhook implementation
4. Show Firebase Admin setup
5. Highlight all fixes made
6. Confirm:

   * System is secure
   * No hardcoded sensitive data
   * Payment flow works end-to-end
   * ID generation works

---

## 🔴 IMPORTANT RULES

* Do NOT skip any issue
* Fix everything completely
* Ensure system is production-ready
* Do NOT leave placeholder logic

---

## ✅ FINAL STEP

Ask:

👉 **“Do you want to proceed with testing or deployment?”**

---

## 💡 Pro Move

After this, also tell AI:

👉 “Add logging and error monitoring for all backend actions”

---

If you want next, I can:
🔥 Give you **ready-to-use Firebase Admin + Paystack webhook code**
🔥 Or help you **secure your Firestore rules manually**

Just tell me 👍
