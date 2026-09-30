const { auth } = require('../config/firebase');

const COLLECTION = 'users';

// Firestore Timestamp -> ISO string (keeps the JSON shape the frontend already expects)
const toISO = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};
const toMillis = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : 0);

const formatUser = (id, data) => ({
  id,
  name: data.name,
  email: data.email,
  phone: data.phone ?? null,
  role: data.role,
  department: data.department ?? null,
  is_active: data.is_active !== false,
  created_at: toISO(data.created_at)
});

// A user's id is their Firebase Auth uid; the profile lives in Firestore users/{uid}
class User {
  constructor(db) {
    this.db = db;
    this.collection = db.collection(COLLECTION);
  }

  async create(userData) {
    const { name, email, password, phone, role = 'citizen', department } = userData;
    const normalizedEmail = email.trim().toLowerCase();

    const record = await auth.createUser({
      email: normalizedEmail,
      password,
      displayName: name,
      disabled: false
    });

    const now = new Date();
    const data = {
      name,
      email: normalizedEmail,
      phone: phone || null,
      role,
      department: department || null,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    try {
      await this.collection.doc(record.uid).set(data);
    } catch (error) {
      // Do not leave an Auth account without a profile
      await auth.deleteUser(record.uid).catch(() => {});
      throw error;
    }

    return formatUser(record.uid, data);
  }

  // Returns a document reference, or null when the id cannot be a valid document id
  ref(id) {
    const value = String(id ?? '');
    return /^[\w-]{1,128}$/.test(value) ? this.collection.doc(value) : null;
  }

  async findById(id) {
    const ref = this.ref(id);
    if (!ref) return undefined;
    const snap = await ref.get();
    if (!snap.exists) return undefined;
    const data = snap.data();
    if (data.is_active === false) return undefined;
    return formatUser(snap.id, data);
  }

  async findByIds(ids) {
    const unique = [...new Set(ids.filter(Boolean).map(String))].filter((id) => this.ref(id));
    if (unique.length === 0) return new Map();
    const snaps = await this.db.getAll(...unique.map((id) => this.collection.doc(id)));
    const map = new Map();
    snaps.forEach((snap) => {
      if (snap.exists) map.set(snap.id, snap.data());
    });
    return map;
  }

  // Active users with one of the given roles, optionally limited to a department
  async findByRoles(roles, { department } = {}) {
    const snap = await this.collection.where('role', 'in', roles).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((user) => user.is_active !== false)
      .filter((user) => !department || user.department === department)
      .sort((a, b) => (a.department || '').localeCompare(b.department || '') || (a.name || '').localeCompare(b.name || ''))
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department ?? null,
        role: user.role
      }));
  }

  async findAll(filters = {}) {
    let query = this.collection;

    if (typeof filters.role === 'string' && filters.role) {
      query = query.where('role', '==', filters.role);
    }
    if (typeof filters.department === 'string' && filters.department) {
      query = query.where('department', '==', filters.department);
    }
    if (filters.is_active !== undefined) {
      query = query.where('is_active', '==', String(filters.is_active) === 'true');
    }

    const snap = await query.get();
    return snap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .sort((a, b) => toMillis(b.data.created_at) - toMillis(a.data.created_at))
      .map(({ id, data }) => formatUser(id, data));
  }

  async updateRole(id, role, department = null) {
    const ref = this.ref(id);
    if (!ref) return undefined;
    const snap = await ref.get();
    if (!snap.exists || snap.data().is_active === false) return undefined;

    await ref.update({ role, department: department || null, updated_at: new Date() });
    return formatUser(ref.id, { ...snap.data(), role, department: department || null });
  }

  async updateProfile(id, updateData) {
    const ref = this.ref(id);
    if (!ref) return undefined;
    const snap = await ref.get();
    if (!snap.exists || snap.data().is_active === false) return undefined;

    const changes = {};
    ['name', 'phone', 'department'].forEach((field) => {
      if (updateData[field] !== undefined) {
        changes[field] = updateData[field] === '' ? null : updateData[field];
      }
    });
    changes.updated_at = new Date();

    await ref.update(changes);
    if (changes.name) {
      await auth.updateUser(ref.id, { displayName: changes.name }).catch(() => {});
    }
    return formatUser(ref.id, { ...snap.data(), ...changes });
  }

  async deactivateUser(id) {
    const ref = this.ref(id);
    if (!ref) return undefined;
    const snap = await ref.get();
    if (!snap.exists) return undefined;

    await ref.update({ is_active: false, updated_at: new Date() });
    await auth.updateUser(ref.id, { disabled: true }).catch(() => {});

    const data = snap.data();
    return { id: ref.id, name: data.name, email: data.email, is_active: false };
  }

  async activateUser(id) {
    const ref = this.ref(id);
    if (!ref) return undefined;
    const snap = await ref.get();
    if (!snap.exists) return undefined;

    await auth.updateUser(ref.id, { disabled: false });
    await ref.update({ is_active: true, updated_at: new Date() });

    const data = snap.data();
    return { id: ref.id, name: data.name, email: data.email, is_active: true };
  }
}

module.exports = User;
