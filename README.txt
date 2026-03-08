# NP Fuel Pass System - Northern Province

The NP Fuel Pass System (NPFS) is a comprehensive fuel consumption monitoring and analysis platform designed for the Northern Province. It provides a secure and efficient way for vehicle owners to manage their fuel quotas and for administrators to monitor distribution.

## Key Features

### 1. Fuel Pass Management
- **Weekly Quota Tracking**: Automatically calculates and displays weekly fuel quotas based on vehicle type.
- **Real-time Balance**: View remaining and consumed fuel amounts instantly.
- **Unique QR Codes**: Generates a secure, unique QR code for each vehicle to facilitate seamless pumping at fuel stations.

### 2. Advanced Authentication
- **Passkey (WebAuthn) Support**: Secure, passwordless login using device biometrics (FaceID, Fingerprint, or Windows Hello).
- **Google Authentication**: Easy sign-in and registration using Google accounts.

### 3. NFC Integration (Android Only)
- **Scan NFC**: Quickly scan fuel pass data from physical NFC tags.
- **Emit NFC**: Share fuel pass information by emitting NFC signals.
- **Pull from NFC**: Retrieve transaction and quota data directly from NFC-enabled devices.

### 4. Transaction & Invoicing
- **Recent Transactions**: Detailed history of all fuel pumping entries, including date, time, station, and amount.
- **Email Invoicing**: Automated delivery of fuel pumping invoices to the user's registered email address.

### 5. Multi-language Support
- The entire interface is available in three languages:
  - **English**
  - **Sinhala (සිංහල)**
  - **Tamil (தமிழ்)**

### 6. Public & Admin Portals
- **Vehicle Quota Lookup**: Publicly accessible portal to check vehicle quotas using ID prefixes and numbers.
- **Complaint Management**: Register and track fuel-related complaints through a dedicated system.
- **Live Station Map**: Real-time map showing fuel station locations and fuel availability.
- **Fuel Prices**: Stay updated with live fuel price information.

### 7. Interactive Assistance
- **AI Chatbot**: Integrated support assistant to help users with queries regarding their fuel pass, quotas, and system usage.

## Technical Stack
- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js (Express), Vite.
- **Database**: Firebase Firestore (Real-time data sync).
- **Authentication**: Firebase Auth & WebAuthn (Passkeys).
- **Email**: Nodemailer integration.
- **QR Codes**: `qrcode.react` for dynamic generation.

---
Developed for the Northern Province Fuel Management Initiative.
