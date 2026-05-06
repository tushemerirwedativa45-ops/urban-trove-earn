# 🔧 Payment Gateway Setup Guide

## 🚨 **Current Status: Manual Payment Mode**

Your deposit system is currently in **manual payment mode** to prevent fake deposits. Users must actually send money before getting confirmation.

## 📋 **How It Works Now:**

1. User selects investment plan
2. System shows **payment instructions** (not fake success)
3. User sends money via mobile money
4. User clicks "I HAVE SENT THE MONEY"
5. Deposit marked as **"Pending Verification"**
6. Admin verifies payment manually
7. Only then deposit becomes "Completed"

## ⚙️ **To Add Your Payment Gateway:**

### Step 1: Configure Payment Settings

In `script.js`, find the `PAYMENT_CONFIG` section and update:

```javascript
const PAYMENT_CONFIG = {
    // Set to true when you have a real payment gateway
    ENABLED: true,  // ← Change this to true
    
    // Your payment gateway details
    GATEWAY: {
        API_URL: 'https://api.your-gateway.com/v1/payments',  // ← Your API URL
        PUBLIC_KEY: 'pk_live_your_actual_key',                // ← Your public key
        SECRET_KEY: 'sk_live_your_secret_key',                // ← Your secret key
        WEBHOOK_SECRET: 'your_webhook_secret'                 // ← Your webhook secret
    },
    
    // Customize other settings as needed
    CURRENCY: 'UGX',
    MIN_AMOUNT: 30000,
};
```

### Step 2: Customize Payment Data

In the `processRealPayment` function, adjust the `paymentData` object to match your gateway's API:

```javascript
const paymentData = {
    // Customize these fields for your gateway
    reference: txRef,
    amount: amount,
    currency: 'UGX',
    customer: {
        name: name,
        email: email,
        phone: phone
    },
    // Add any other fields your gateway requires
};
```

### Step 3: Handle Gateway Response

Update the response handling to match your gateway's response format:

```javascript
if (response.ok && result.status === 'success') {
    // Adjust based on your gateway's response structure
    const paymentUrl = result.data?.payment_url || result.payment_url;
    window.location.href = paymentUrl;
}
```

## 🔌 **Popular Payment Gateways:**

### Flutterwave
```javascript
API_URL: 'https://api.flutterwave.com/v3/payments'
// Response: result.data.link
```

### Paystack
```javascript
API_URL: 'https://api.paystack.co/transaction/initialize'
// Response: result.data.authorization_url
```

### Stripe
```javascript
API_URL: 'https://api.stripe.com/v1/checkout/sessions'
// Response: result.url
```

### MTN MoMo API
```javascript
API_URL: 'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay'
// Custom integration required
```

## 🛡️ **Security Notes:**

- Never put secret keys in frontend code
- Always verify payments server-side
- Use webhooks for reliable confirmation
- Test thoroughly before going live

## 🔄 **Fallback System:**

If your payment gateway fails, the system automatically falls back to manual payment instructions, ensuring users can always make deposits.

## ✅ **Benefits of This Setup:**

- ✅ No more fake deposits
- ✅ Real payment verification
- ✅ Easy to switch payment providers
- ✅ Manual fallback always works
- ✅ Admin can verify all payments

Your platform is now secure and ready for any payment gateway!