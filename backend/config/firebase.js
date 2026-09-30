const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

dotenv.config();

const loadCredential = () => {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    // Relative paths are resolved from the backend folder
    const resolved = path.resolve(__dirname, '..', serviceAccountPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH points to a missing file: ${resolved}`);
    }
    return cert(JSON.parse(fs.readFileSync(resolved, 'utf8')));
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });
  }

  throw new Error(
    'Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_PATH, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in backend/.env'
  );
};

const app = getApps().length ? getApps()[0] : initializeApp({ credential: loadCredential() });

const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

const auth = getAuth(app);

module.exports = { db, auth };
