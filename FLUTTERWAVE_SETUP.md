# 🔧 Flutterwave Payment Integration Setup

## ⚠️ IMPORTANT: Replace Demo Keys

Your deposit system was showing fake success because it wasn't connected to real payments. Here's how to fix it:

## 1. Get Flutterwave API Keys

1. Sign up at [Flutterwave.com](https://flutterwave.com)
2. Go to Settings > API Keys
3. Copy your **Public Key** and **Secret Key**

## 2. Update Payment Keys

### In `script.js` (line ~200):
```javascript
// Replace this line:
'Authorization': 'Bearer FLWPUBK_TEST-SANDBOXDEMOKEY-X',

// With your real public key:
'Authorization': 'Bearer FLWPUBK_TEST-your-actual-public-key-here',
```

### In `payment-callback.html` (line ~60):
```javascript
// Replace this line:
'Authorization': 'Bearer FLWSECK_TEST-SANDBOXDEMOKEY-X'

// With your real secret key:
'Authorization': 'Bearer FLWSECK_TEST-your-actual-secret-key-here'
```

## 3. Set Environment Variables

Add to your deployment environment:
```bash
FLW_SECRET_HASH=your-webhook-secret-hash
```

## 4. Configure Webhook URL

In your Flutterwave dashboard:
- Go to Settings > Webhooks
- Add webhook URL: `https://your-domain.com/api/flutterwave-webhook`
- Set secret hash (same as FLW_SECRET_HASH above)

## 5. Test Payment Flow

1. Use test card: `4187427415564246`
2. CVV: `828`, Expiry: `09/32`, PIN: `3310`
3. Verify payment completes before showing success

## 🚨 Security Notes

- **Never** put secret keys in frontend code
- Always verify payments server-side
- Use webhooks for reliable payment confirmation
- Test thoroughly before going live

## 📱 Supported Payment Methods

- MTN Mobile Money Uganda
- Airtel Money Uganda  
- Visa/Mastercard
- Bank transfers

Your platform will now require **real payment** before showing deposit success!