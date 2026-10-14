# Quick 261015-14r — Commerce Solidaire: Casablanca / Monde split
1. Worker: /api/monde/products (Printify live, cached) + /api/monde/checkout (Stripe Checkout) + /api/monde/webhook (Stripe -> Printify order)
2. Client: tabs Casablanca (existing) | Monde (product grid + cart->checkout, empty state)
3. i18n fr/en/ar
Secrets: PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
