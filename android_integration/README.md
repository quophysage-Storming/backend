# On_Time_Arrival Android App Integration Guide

This guide explains how the **On_Time_Arrival** Android app connects with the **SeevPlus Payment & Arkesel SMS Backend**.

---

## 1. QR Code Data Structure

In `DashActivity.java`, the app creates the QR code with:
```java
JSONObject o = new JSONObject();
o.put("kid", kid);       // Child's Name (e.g. "Esi Mensah")
o.put("phone", phone);   // Parent's Mobile Number (e.g. "+233 24 123 4567")
o.put("school", school); // School / Institution (e.g. "Accra Academy")
```

The backend natively parses this exact JSON structure upon checkpoint scan!

---

## 2. Checkpoint Scan API Call (`POST /api/scans/process`)

When the user taps **"Scan QR"** (`linear19` in `DashActivity`), retrieve the device GPS location and send a POST request:

### HTTP Request:
- **URL**: `http://<YOUR_BACKEND_IP>:5000/api/scans/process`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "qrData": "{\"kid\":\"Esi Mensah\",\"phone\":\"+233241234567\",\"school\":\"Accra Academy\"}",
  "latitude": 5.5560,
  "longitude": -0.1969,
  "location": "Main Entrance Gate",
  "scannedAt": "2026-11-15T07:50:00Z"
}
```

### Response (On Time):
```json
{
  "success": true,
  "scanId": "a1b2c3d4-...",
  "user": {
    "name": "Esi Mensah",
    "guardianPhone": "233241234567",
    "institution": "Accra Academy"
  },
  "evaluation": {
    "arrivalStatus": "ON_TIME",
    "scannedTime": "07:50 AM",
    "scannedDate": "Sun, 15 Nov 2026",
    "isLate": false
  },
  "location": {
    "displayName": "Main Entrance Gate (GPS: 5.5560, -0.1969)"
  },
  "smsNotification": {
    "success": true,
    "recipients": ["233241234567"],
    "message": "SeevPlus OnTime: Hello, Esi Mensah has arrived at Main Entrance Gate ON TIME at 07:50 AM (Sun, 15 Nov 2026). Safe arrival confirmed!"
  }
}
```

---

## 3. SeevPlus Payment API Call (`POST /api/payments/initialize`)

To activate the subscription for a parent's phone number:

### HTTP Request:
- **URL**: `http://<YOUR_BACKEND_IP>:5000/api/payments/initialize`
- **Method**: `POST`
- **Body**:
```json
{
  "phone": "+233 24 123 4567",
  "kid": "Esi Mensah",
  "school": "Accra Academy",
  "planType": "monthly",    // or "yearly"
  "momoNetwork": "MTN"     // "MTN", "TELECEL", or "AT_MONEY"
}
```

### Plans:
- **Monthly**: `50 GHC` (30 days validity)
- **Yearly**: `588 GHC` (365 days validity)

### Checking Subscription Status (`GET /api/payments/status`):
- **URL**: `http://<YOUR_BACKEND_IP>:5000/api/payments/status?phone=0241234567`
```json
{
  "success": true,
  "hasActiveSubscription": true,
  "daysRemaining": 30,
  "subscription": {
    "planName": "OnTime Arrival Monthly Subscription",
    "amountPaid": 50,
    "currency": "GHS",
    "status": "ACTIVE"
  }
}
```
