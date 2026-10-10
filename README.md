# Nexus Corporate

### Secure Invoice Management & Payment Automation Platform

Nexus Corporate is a full-stack invoice management application designed to simplify invoice creation, client management, online payments, and payment receipt delivery.

The platform provides role-based access for administrators and clients, secure invoice handling, Stripe payment integration, automated PDF generation, and email notifications.

## Features

### Authentication & Security

* Secure login and logout.
* JWT-based authentication.
* Role-based access for administrators and clients.
* Password hashing using bcrypt.
* Server-side authorization and IDOR prevention.
* Protected API endpoints.
* Input validation and error handling.

### Invoice Management

* Create and manage client invoices.
* Add multiple products or services to an invoice.
* Automatically calculate subtotals, taxes, and totals.
* Set invoice dates and payment due dates.
* Track Draft, Pending, Paid, and Cancelled statuses.
* Generate and download professional PDF invoices.
* Restrict invoice access to authorized users.

### Payment Processing

* Stripe Checkout integration.
* Secure server-side payment verification.
* Stripe webhook signature validation.
* Automatic invoice status updates after confirmed payment.
* Duplicate webhook event protection.

### PDF Receipts & Email Notifications

* Automatically generate PDF receipts after successful payment.
* Include the Nexus Corporate logo and a PAID stamp.
* Email receipts to the client's registered email address.
* Support persistent receipt storage.
* Handle email delivery failures and retries.

### Dashboards

**Administrator dashboard**

* Manage clients.
* Create and manage invoices.
* View payment activity.
* Monitor paid and outstanding invoices.
* Access administrative analytics.

**Client dashboard**

* View personal invoices.
* Check payment status.
* Pay eligible invoices through Stripe.
* Download authorized invoice PDFs and payment receipts.

## Technology Stack

**Frontend**

* React
* Vite
* TypeScript
* Tailwind CSS
* React Router
* Axios
* Lucide React

**Backend**

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT
* bcryptjs
* Stripe SDK
* PDFKit
* Nodemailer

**Deployment**

* Vercel for the frontend.
* Render for the backend.
* MongoDB Atlas for database hosting.
* Stripe for payment processing.
* SMTP for email delivery.
* AWS S3 or another persistent storage provider for production PDF storage.

## Project Structure

```text
nexus-corporate/
├── client/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   └── package.json
├── Prompts.md
├── README.md
└── .gitignore
```

The actual directory structure may vary slightly depending on the implementation.

## Prerequisites

Install the following before running the project:

* Node.js and npm.
* MongoDB Atlas account or a local MongoDB instance.
* Stripe account with test mode enabled.
* SMTP credentials for email delivery.
* Git.

Optional for production receipt storage:

* AWS account with an appropriately configured S3 bucket.

## Installation

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd nexus-corporate
```

Replace the repository placeholder with your actual GitHub repository URL.

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Install backend dependencies

Open another terminal:

```bash
cd server
npm install
```

### 4. Configure environment variables

Create a `.env` file in the server directory.

Use the following template and replace the blank values with your own configuration.

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=1d

CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

RECEIPT_STORAGE_PROVIDER=local
RECEIPT_LOCAL_DIRECTORY=./storage/receipts

AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Create a frontend `.env` file inside `client` if required by the implementation.

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_STRIPE_PUBLISHABLE_KEY=
```

Never expose secret keys through frontend environment variables. Only public configuration values should use the `VITE_` prefix.

Do not commit `.env` files or production credentials to GitHub.

### 5. Start the backend

From the `server` directory, run:

```bash
npm run dev
```

If the project does not define a development script, use the command configured in its `package.json`.

### 6. Start the frontend

From the `client` directory, run:

```bash
npm run dev
```

Open the local frontend address shown in the terminal, typically:

```text
http://localhost:5173
```

The backend API is typically available at:

```text
http://localhost:5000/api
```

Actual ports depend on your environment configuration.

## Authentication and Access Control

The application supports two user roles.

**Administrator**

* Creates and manages invoices.
* Manages client accounts.
* Views administrative dashboard information.

**Client**

* Views their own invoices.
* Pays eligible invoices.
* Downloads authorized documents.

All protected endpoints must verify authentication and enforce permissions on the backend.

Invoice queries must be scoped to the authenticated client's identity. A client must not be able to access another client's invoice by changing an invoice ID in the URL.

Create administrator accounts through a controlled setup or seeding process. Public registration must not allow users to assign themselves the administrator role.

## Payment Workflow

The payment lifecycle is designed as follows:

1. An administrator creates an invoice.
2. The client logs in and opens an eligible invoice.
3. The client initiates payment through Stripe Checkout.
4. Stripe processes the payment.
5. Stripe sends a signed webhook to the backend.
6. The backend verifies the webhook signature and payment details.
7. The invoice is marked Paid after successful verification.
8. A PDF payment receipt is generated.
9. The receipt is saved using the configured storage provider.
10. Nodemailer emails the receipt to the registered client.

The application must never mark an invoice as paid solely because the client reaches the payment success page.

## Stripe Webhook Configuration

For local testing, install and configure the Stripe CLI using the official documentation:

https://docs.stripe.com/stripe-cli

Forward Stripe events to the local backend using a command similar to:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Use the webhook signing secret provided by the CLI for local testing.

For production, configure the deployed endpoint in the Stripe Dashboard:

```text
https://YOUR-BACKEND-DOMAIN/api/webhooks/stripe
```

Use the endpoint-specific signing secret in the backend's environment variables.

The webhook implementation must verify the original raw request body using Stripe's signature verification method.

## Testing

Run the tests configured by the project.

For example:

```bash
cd server
npm test
```

Verify the following scenarios:

* Missing or invalid authentication tokens are rejected.
* Clients cannot access administrative endpoints.
* Clients cannot access another client's invoices.
* Invoice totals cannot be manipulated through frontend requests.
* Invalid Stripe webhook signatures are rejected.
* Duplicate webhook events do not trigger duplicate successful email deliveries.
* PDF downloads enforce invoice ownership.
* Email delivery failures can be retried safely.

Use Stripe test mode for payment testing. Do not use real payment credentials in automated tests.

## Deployment

### Frontend — Vercel

1. Push the project to GitHub.
2. Import the frontend project into Vercel.
3. Configure the frontend build settings.
4. Add the required frontend environment variables.
5. Deploy the application.

### Backend — Render

1. Create a web service connected to the backend repository.
2. Configure the Node.js build and start commands.
3. Add backend environment variables.
4. Configure the production CORS origin.
5. Deploy the backend.
6. Confirm that the health endpoint responds correctly.

### Database — MongoDB Atlas

1. Create a database cluster.
2. Configure database access permissions.
3. Allow network access from the deployed backend.
4. Add the MongoDB connection string to the backend environment variables.

### Receipt Storage

Use persistent cloud storage for production PDF receipts. Do not rely on temporary local files surviving Render restarts or redeployments.

## Environment and Security Checklist

Before deployment, verify that:

* JWT secrets are securely configured.
* Stripe secret keys remain on the backend.
* Webhook signatures are verified.
* SMTP credentials are protected.
* Database credentials are not committed to GitHub.
* CORS allows only the intended application origins.
* Administrative APIs enforce role checks.
* Invoice endpoints enforce ownership checks.
* Receipt downloads require authorization.
* Payment status changes only after verified payment.
* Production error responses do not expose stack traces or secrets.

## AI-Assisted Development

The `Prompts.md` file documents AI-assisted development, including architecture, authentication, IDOR prevention, Stripe integration, webhook verification, PDF generation, email delivery, and security testing.

Review and update this file to accurately reflect the prompts used, the code changes made, and the tests actually performed.

## Project Status

**Development status:** Update this section to reflect the actual state of the application.

Before describing the application as production-ready, verify the frontend, backend, database, authentication, payment workflow, PDF generation, email delivery, deployment, and security tests.

## License

Add the applicable license and ownership information before publishing the repository.
