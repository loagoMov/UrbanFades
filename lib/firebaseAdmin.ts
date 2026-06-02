import admin from 'firebase-admin';

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_B64 env var. ' +
        'Add your Firebase service account JSON (base64-encoded) to .env.local.'
    );
  }

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    throw new Error(
      'Failed to parse FIREBASE_SERVICE_ACCOUNT_B64. Make sure it is a valid base64-encoded JSON string.'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

const app = getAdminApp();
const auth = admin.auth(app);

export { admin, auth };
