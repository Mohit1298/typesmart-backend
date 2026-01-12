# Environment Variables Setup

Create a `.env.local` file in the backend folder with these variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key

# App
JWT_SECRET=your-super-secret-jwt-key
ADMIN_EMAIL=admin@yourcompany.com
```

## Getting Your Keys

### Supabase
1. Go to https://supabase.com and create a project
2. Go to Settings → API
3. Copy the URL and anon key
4. Copy the service_role key (keep this secret!)

### OpenAI
1. Go to https://platform.openai.com
2. Create an API key

### Stripe
1. Go to https://dashboard.stripe.com
2. Get your test keys from Developers → API Keys
3. Set up webhook endpoint and get the webhook secret






