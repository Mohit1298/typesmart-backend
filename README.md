# OpenDoor Backend

Backend API and Admin Panel for OpenDoor AI Keyboard.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase-schema.sql`
3. Copy your project URL and keys from Settings → API

### 3. Set Up Stripe

1. Create an account at [stripe.com](https://stripe.com)
2. Create products/prices in the Stripe dashboard:
   - **Pro Monthly**: $5/month subscription
   - **Credits Pack 100**: $1 one-time (100 credits)
   - **Credits Pack 500**: $4 one-time (500 credits)
3. Get your API keys from Developers → API Keys
4. Set up a webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Events to listen: `customer.subscription.*`, `payment_intent.succeeded`, `invoice.payment_failed`

### 4. Configure Environment

Create `.env.local` with your keys (see `ENV_SETUP.md`).

### 5. Run Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3001`

---

## 📁 Project Structure

```
backend/
├── lib/
│   ├── supabase.ts      # Database client & helpers
│   ├── stripe.ts        # Payment processing
│   ├── openai.ts        # AI request handling
│   └── auth.ts          # Authentication
├── pages/
│   ├── api/
│   │   ├── ai/
│   │   │   └── process.ts       # Main AI endpoint
│   │   ├── auth/
│   │   │   ├── signup.ts        # User registration
│   │   │   ├── login.ts         # User login
│   │   │   ├── apple.ts         # Sign in with Apple
│   │   │   └── me.ts            # Get current user
│   │   ├── admin/
│   │   │   ├── users.ts         # List users
│   │   │   └── users/[userId]/
│   │   │       ├── index.ts     # User details
│   │   │       ├── credits.ts   # Add credits
│   │   │       └── vip.ts       # Toggle VIP
│   │   └── stripe/
│   │       ├── webhook.ts       # Stripe webhooks
│   │       └── create-checkout.ts
│   ├── admin/
│   │   └── index.tsx            # Admin dashboard
│   └── index.tsx                # Landing page
└── supabase-schema.sql          # Database schema
```

---

## 🔌 API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Register new user |
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/apple` | POST | Sign in with Apple |
| `/api/auth/me` | GET | Get current user & credits |

### AI Processing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/process` | POST | Process AI request |

**Request Body:**
```json
{
  "action": "rephrase|generate|grammar|formal|casual|analyze|reply|extract",
  "text": "optional text",
  "imageBase64": "optional base64 image"
}
```

### Admin (requires admin token)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/[id]` | GET | User details |
| `/api/admin/users/[id]/credits` | POST | Add credits |
| `/api/admin/users/[id]/vip` | POST | Toggle VIP |

---

## 💰 Credit System

| Plan | Monthly Credits | Overage |
|------|-----------------|---------|
| Free | 50 | Blocked |
| Pro ($5/mo) | 500 | $0.01/credit |
| Unlimited ($15/mo) | ∞ | N/A |

**Credit Costs:**
- Text request: 1 credit
- Vision request: 3 credits

**Bonus Credits:**
- Never expire
- Manually added by admin
- Used after monthly credits

---

## 🛡️ Admin Features

Access at `/admin`:

- 📊 View user statistics
- 🔍 Search users by email
- 🎁 Add bonus credits to any user
- ⭐ Toggle VIP status
- 📝 Add admin notes
- 📈 View usage history

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

### Other Platforms

Works with any Node.js hosting:
- Railway
- Render
- DigitalOcean App Platform
- AWS Lambda

---

## 🔐 Security

- JWT tokens for authentication
- bcrypt for password hashing
- Row Level Security in Supabase
- API key stored server-side only
- Admin-only endpoints protected

---

## 📱 iOS Integration

Update your iOS app to call this backend instead of OpenAI directly:

```swift
// Before
let url = "https://api.openai.com/v1/chat/completions"

// After
let url = "https://your-backend.com/api/ai/process"
```

See the iOS update guide for full integration instructions.
