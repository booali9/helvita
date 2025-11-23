# Helvita Backend 

Node.js backend for Helvita with personal and business account registration, OTP verification, Stripe identity, and card creation.

## Setup

1. Install dependencies: `npm install`
2. Set up MongoDB locally or use a cloud service.
3. Copy `.env.example` to `.env` and update with real values:
   - MONGO_URI
   - JWT_SECRET
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - EMAIL_USER
   - EMAIL_PASS
   - OTP_EXPIRY
4. Run: `npm start` or `npm run dev`

## API Documentation

Access Swagger docs at: `http://localhost:5000/api-docs`

## API Endpoints

### Auth
- POST /api/auth/register: Register with email, password, accountType (personal/business). Sends OTP.
- POST /api/auth/verify-otp: Verify OTP with email and otp.
- POST /api/auth/login: Login (requires emailVerified, identityVerified, adminApproved).

### Personal Account Onboarding
- POST /api/personal/investment-setup: Set investment type.
- POST /api/personal/details: Personal details (name, address, SSN, DOB).
- POST /api/personal/bank-setup: Bank account info.
- POST /api/personal/identity/start: Start Stripe identity verification.
- POST /api/personal/card/create: Create Stripe issuing card.

### Business Account Onboarding
- POST /api/business/investment-setup: Set investment type.
- POST /api/business/address: Residence address.
- POST /api/business/company-details: Business details (type, role, EIN, etc.).
- POST /api/business/identity/start: Start Stripe identity verification.
- POST /api/business/card/create: Create Stripe issuing business card.

### Admin
- GET /api/admin/users/pending: Get users pending approval.
- POST /api/admin/users/:userId/approve: Approve user.
- POST /api/admin/users/:userId/reject: Reject user with reason.

### Webhooks
- POST /api/webhook/stripe-identity: Handle Stripe identity verification webhook.

## User Flow

### Personal Account:
1. Register → OTP → Verify → Investment Setup → Personal Details → Bank Setup → Identity Start → Card Create → Admin Approve → Login

### Business Account:
1. Register → OTP → Verify → Investment Setup → Address → Company Details → Identity Start → Card Create → Admin Approve → Login

## Database Schemas

- User: email, password, accountType, emailVerified, identityVerified, adminApproved, otp, stripeCustomerId, etc.
- PersonalProfile: investmentType, fullName, address, SSN, bank details, stripeVerificationStatus
- BusinessProfile: investmentType, residential info, business details, stripeVerificationStatus

## Testing

Import `Helvita_API_Postman_Collection.json` into Postman to test all API endpoints. The collection includes:
- Environment variables for base URL and JWT token
- Sample requests with proper headers and body data
- Authentication flow examples

**Note**: The `.env` file contains sensitive information and is not committed to version control. Copy `.env.example` to `.env` and fill in your actual credentials.
