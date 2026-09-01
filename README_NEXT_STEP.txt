VFA Portal - student authentication connection

This build connects Admin > Save Students to the deployed Supabase Edge Function named bright-api.

IMPORTANT: In Supabase Edge Functions, replace bright-api/index.ts with bright-api-index.ts from this package and deploy it.
The function securely creates and deletes student Supabase Auth accounts.

The website uses the existing VFA Student ID + assigned password login. Passwords are generated once for new students and are not regenerated on reload/login.

Do not put a Supabase secret/service key in the browser.
