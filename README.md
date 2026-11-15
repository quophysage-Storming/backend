# SeevPlus OnTime Arrival & Arkesel SMS Backend

A dedicated Node.js/Express backend service for **SeevPlus OnTime Arrival** subscriptions and **Arkesel SMS** notifications triggered upon QR code scans at checkpoints.

---

## 🌟 Key Features

1. **SeevPlus Subscription Engine**:
   - **Monthly Subscription**: `50 GHC` (30 days validity).
   - **Yearly Subscription**: `588 GHC` (365 days validity).
   - Native mobile money (MTN, Telecel, AT Money) payment processing without third-party redirects like Paystack.
   - Subscription validity checks and automatic expiry management.

2. **Arkesel SMS API v2 Integration**:
   - Automatic dispatch of SMS alerts to guardians/parents and students upon check-in.
   - Differentiates between **ON TIME** and **LATE** arrival based on individual expected arrival times.
   - Built-in sandbox/mock mode for development and live mode for production via `ARKESEL_API_KEY`.
   - SMS credit balance endpoint and persistent delivery audit logging.

3. **Tamper-Proof QR Code Engine**:
   - Generates HMAC-SHA256 cryptographically signed QR codes for each registered student/worker.
   - Validates QR tokens during checkpoint scans to prevent forgery.
   - Gate checks ensure check-in only succeeds when a user holds an active SeevPlus subscription.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Key variables:
- `PORT`: Server port (default: `5000`)
- `ARKESEL_API_KEY`: Your live API key from Arkesel (leave as default for sandbox mode)
- `ARKESEL_SENDER_ID`: Sender ID (max 11 chars, e.g. `SeevPlus`)
- `DEFAULT_ARRIVAL_TIME`: Default arrival cutoff (e.g. `08:00`)
- `GRACE_PERIOD_MINUTES`: Grace period in minutes (default: `10`)

### 3. Run the Server
```bash
npm start
```
Or for development with auto-reload:
```bash
npm run dev
```

### 4. Run Integration Tests
```bash
npm test
```

---

## 📡 REST API Reference

### 1. Subscription & Payment Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/payments/plans` | List available subscription plans (50 GHC monthly & 588 GHC yearly) |
| `POST` | `/api/payments/initialize` | Initialize a SeevPlus subscription payment (`userId`, `planType`, `paymentMethod`, `momoNetwork`) |
| `POST` | `/api/payments/confirm` | Confirm/finalize payment reference and activate/extend subscription |
| `GET` | `/api/payments/status/:userId` | Check active subscription status and remaining days for a user |
| `GET` | `/api/payments/history` | View transaction history |

### 2. User Management Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/users` | Register a new student or worker (`name`, `phone`, `guardianPhone`, `expectedArrivalTime`, `institution`) |
| `GET` | `/api/users` | List all registered users with their current subscription status |
| `GET` | `/api/users/:id` | Get user details along with generated QR badge pass |

### 3. Checkpoint QR Scanning Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/scans/process` | Scan a QR code at checkpoint (`token`, `location`, `scannedAt`). Checks subscription, evaluates arrival, triggers Arkesel SMS |
| `GET` | `/api/scans/pass/:userId` | Retrieve user QR pass badge data URL & token |
| `GET` | `/api/scans/logs` | View scan history and arrival audit trail |

### 4. Arkesel SMS Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sms/send` | Send direct/custom SMS via Arkesel v2 (`recipients`, `message`) |
| `GET` | `/api/sms/balance` | Check Arkesel SMS credit balance |
| `GET` | `/api/sms/logs` | View SMS delivery audit logs |

---

## 🧪 Verified Integration Tests

All core capabilities are covered by automated tests in `tests/integration.test.js`:
- Plan pricing validation (50 GHC & 588 GHC)
- Ghana phone formatting (`024...` -> `23324...`)
- Subscription activation and expiration rules
- Blocking checkpoint check-in for unpaid/inactive users
- Cryptographic HMAC QR signature generation and validation
- Realtime arrival evaluation (On-time vs Late)
- Automatic Arkesel SMS dispatch and audit logging
