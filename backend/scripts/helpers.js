const { db, auth } = require('../config/firebase');

// Creates the Firebase Auth account and Firestore profile if they do not exist yet.
// With `sync: true` an existing profile is also updated to match (used for demo/seed accounts only).
// Returns { id, created }.
const ensureUser = async ({ name, email, password, phone = null, role = 'citizen', department = null }, { sync = false } = {}) => {
  const normalizedEmail = email.trim().toLowerCase();
  let record;
  let created = false;

  try {
    record = await auth.getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    record = await auth.createUser({
      email: normalizedEmail,
      password,
      displayName: name,
      disabled: false
    });
    created = true;
  }

  const ref = db.collection('users').doc(record.uid);
  const snap = await ref.get();
  const now = new Date();

  if (!snap.exists) {
    await ref.set({
      name,
      email: normalizedEmail,
      phone,
      role,
      department,
      is_active: true,
      created_at: now,
      updated_at: now
    });
    created = true;
  } else if (sync) {
    await ref.update({ name, phone, role, department, is_active: true, updated_at: now });
  }

  return { id: record.uid, created };
};

module.exports = { db, auth, ensureUser };
