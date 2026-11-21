AUTHENTICATION MODULE - INTEGRATION STEPS

This is a patch for the existing currency-economic-tracker project. Copy the files into the matching folders, overwriting main.jsx and adding the other files. The patch expects the existing App.jsx, db.js and index.js from the Phase 1 project.

1. Copy client/src/AuthPages.jsx and client/src/AuthGate.jsx into client/src/.
2. Copy client/src/auth.css into client/src/.
3. Replace client/src/main.jsx with the supplied main.jsx.
4. Merge the supplied client/package.json dependency (react-router-dom) into your existing package.json. Do not delete existing dependencies.
5. Copy server/src/authRoutes.js into server/src/.
6. Merge the supplied server/src/index.js and server/src/db.js changes into your existing files. The supplied index.js is based on the Phase 1 starter. If your local files have changed, add the authRoutes import and app.use('/api/auth', authRoutes) line manually, and add the two CREATE TABLE statements from db.js.
7. Merge bcryptjs, jsonwebtoken and nodemailer into server/package.json dependencies. Keep all existing dependencies.
8. Add the variables from server/.env.additions.example to your existing server/.env. Configure them with credentials from a real SMTP/email provider. Do not share or commit .env.
9. Run npm install inside both client and server folders.
10. Restart the backend and frontend. The backend auto-creates users and pending_registrations tables when DB_AUTO_INIT is not false.

ROUTES
/login and /register are handled by React Router. Login calls POST /api/auth/login. Registration calls POST /api/auth/request-otp then POST /api/auth/verify-register.

IMPORTANT
- This module stores bcrypt password hashes and bcrypt OTP hashes, not plaintext values.
- OTP validity is 5 minutes; resend cooldown is 60 seconds; after 5 incorrect OTP attempts the pending registration is deleted.
- The JWT is stored in localStorage for this starter implementation. For a production/public deployment, prefer secure HttpOnly cookies, add CSRF protection, and enforce authentication on protected API routes too.
- The dashboard UI is gated by AuthGate, but existing dashboard API routes are not yet JWT-protected. Do not expose this as a production service until server-side API authorization and logout/session revocation are added.
- Test email delivery with your provider before relying on registration.
