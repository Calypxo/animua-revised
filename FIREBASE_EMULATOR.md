# Local Firebase development

The local development workflow uses the isolated `demo-animua` project. It does
not read from or write to the production Firebase project.

## Prerequisites

- Node.js and the project dependencies
- Firebase CLI
- Java JDK 21 or newer

## Start the complete local system

From the repository root, run:

```powershell
npm run dev:emulator
```

This starts Firebase Authentication, Firestore, Storage, the Node backend, the
sentiment service when its local environment is available, and both Vite sites.
The terminal prints the frontend addresses when they are ready.

Public site: `http://127.0.0.1:5173/`

Management site: `http://127.0.0.1:5174/`

Firebase Emulator UI: `http://127.0.0.1:4000`

Seeded management account:

```text
Email: admin@animua.test
Password: AnimuaDev123!
```

The seed script refuses to run unless every Firebase host points to localhost.
Production builds do not connect to the emulators.

Set `VITE_USE_FIREBASE_EMULATORS=false` only when you intentionally need a Vite
development server to use the production Firebase project.
