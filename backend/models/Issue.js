const User = require('./User');

const COLLECTION = 'issues';
const HISTORY = 'status_history';

const STATUS_ORDER = ['reported', 'acknowledged', 'in_progress', 'resolved', 'verified'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Firestore Timestamp -> ISO string / milliseconds
const toISO = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};
const toMillis = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : 0);

// Raw issue ({ id, ...firestoreData }) -> API shape
const formatIssue = (raw) => ({
  id: raw.id,
  latitude: raw.latitude,
  longitude: raw.longitude,
  address: raw.address ?? null,
  category: raw.category,
  title: raw.title,
  description: raw.description,
  severity: raw.severity,
  photos: Array.isArray(raw.photos) ? raw.photos : [],
  reported_by: raw.reported_by ?? null,
  assigned_to: raw.assigned_to ?? null,
  serviceman_id: raw.serviceman_id ?? null,
  status: raw.status,
  internal_notes: raw.internal_notes ?? null,
  resolved_at: toISO(raw.resolved_at),
  created_at: toISO(raw.created_at),
  updated_at: toISO(raw.updated_at)
});

// Error with an HTTP status so routes can answer with the right code
const fail = (status, message) => Object.assign(new Error(message), { status });

class Issue {
  constructor(db) {
    this.db = db;
    this.collection = db.collection(COLLECTION);
    this.userModel = new User(db);
  }

  // Returns a document reference, or null when the id cannot be a valid document id
  ref(id) {
    const value = String(id ?? '');
    return /^[\w-]{1,128}$/.test(value) ? this.collection.doc(value) : null;
  }

  async create(issueData) {
    const {
      latitude, longitude, address, category, title,
      description, severity, photos, reported_by
    } = issueData;

    const now = new Date();
    const ref = this.collection.doc();
    const data = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address ?? null,
      category,
      title,
      description,
      severity: parseInt(severity, 10),
      photos: Array.isArray(photos) ? photos : [],
      reported_by,
      assigned_to: null,
      serviceman_id: null,
      status: 'reported',
      internal_notes: null,
      resolved_at: null,
      created_at: now,
      updated_at: now
    };

    const batch = this.db.batch();
    batch.set(ref, data);
    batch.set(ref.collection(HISTORY).doc(), {
      status: 'reported',
      updated_by: reported_by,
      notes: null,
      created_at: now
    });
    await batch.commit();

    return formatIssue({ id: ref.id, ...data });
  }

  // Adds reporter / official / serviceman details to raw issues (replaces the SQL joins)
  async attachUsers(rawIssues, { includeReporterPhone = false, includeAssignee = true } = {}) {
    const ids = [];
    rawIssues.forEach((issue) => {
      ids.push(issue.reported_by);
      if (includeAssignee) ids.push(issue.assigned_to, issue.serviceman_id);
    });
    const users = await this.userModel.findByIds(ids);

    return rawIssues.map((raw) => {
      const reporter = users.get(raw.reported_by);
      const issue = {
        ...formatIssue(raw),
        reported_by_name: reporter ? reporter.name : null,
        reported_by_email: reporter ? reporter.email : null
      };
      if (includeReporterPhone) {
        issue.reported_by_phone = reporter ? reporter.phone ?? null : null;
      }
      if (includeAssignee) {
        const assignee = users.get(raw.assigned_to);
        issue.assigned_to_name = assignee ? assignee.name : null;
        issue.assigned_to_email = assignee ? assignee.email : null;
        issue.department = assignee ? assignee.department ?? null : null;
        const serviceman = users.get(raw.serviceman_id);
        issue.serviceman_name = serviceman ? serviceman.name : null;
        issue.serviceman_email = serviceman ? serviceman.email : null;
      }
      return issue;
    });
  }

  async findAll(filters = {}) {
    // Equality filters run in Firestore (no composite index needed);
    // range filters, ordering and the 1000 cap are applied in memory.
    let query = this.collection;

    if (typeof filters.category === 'string' && filters.category && filters.category !== 'all') {
      query = query.where('category', '==', filters.category);
    }
    if (typeof filters.status === 'string' && filters.status && filters.status !== 'all') {
      query = query.where('status', '==', filters.status);
    }
    if (typeof filters.assigned_to === 'string' && filters.assigned_to) {
      query = query.where('assigned_to', '==', filters.assigned_to);
    }
    if (typeof filters.reported_by === 'string' && filters.reported_by) {
      query = query.where('reported_by', '==', filters.reported_by);
    }

    const snap = await query.get();
    let issues = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (filters.severity) {
      const minSeverity = parseInt(filters.severity, 10);
      if (!Number.isNaN(minSeverity)) {
        issues = issues.filter((issue) => issue.severity >= minSeverity);
      }
    }

    const start = filters.startDate ? new Date(filters.startDate).getTime() : NaN;
    if (!Number.isNaN(start)) {
      issues = issues.filter((issue) => toMillis(issue.created_at) >= start);
    }

    const end = filters.endDate ? new Date(filters.endDate).getTime() : NaN;
    if (!Number.isNaN(end)) {
      issues = issues.filter((issue) => toMillis(issue.created_at) <= end);
    }

    issues.sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
    return this.attachUsers(issues.slice(0, 1000));
  }

  async findById(id) {
    const ref = this.ref(id);
    if (!ref) return undefined;

    const snap = await ref.get();
    if (!snap.exists) return undefined;

    const [issue] = await this.attachUsers([{ id: snap.id, ...snap.data() }], { includeReporterPhone: true });
    return issue;
  }

  // `guard(issue)` may return { status, message } to reject the change inside the transaction
  async updateStatus(id, status, updatedBy, internalNotes = null, guard = null) {
    const ref = this.ref(id);
    if (!ref) return undefined;

    const now = new Date();

    return this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) return undefined;

      const current = formatIssue({ id: snap.id, ...snap.data() });
      const problem = guard ? guard(current) : null;
      if (problem) throw fail(problem.status, problem.message);

      const changes = { status, updated_at: now };
      if (internalNotes) changes.internal_notes = internalNotes;
      if (status === 'resolved') changes.resolved_at = now;

      transaction.update(ref, changes);
      transaction.set(ref.collection(HISTORY).doc(), {
        status,
        updated_by: updatedBy,
        notes: internalNotes || null,
        created_at: now
      });

      return formatIssue({ id: snap.id, ...snap.data(), ...changes });
    });
  }

  // Admin assigns an issue to an official (only before work has started)
  async assignToOfficial(id, official, assignedBy) {
    const ref = this.ref(id);
    if (!ref) return undefined;

    const now = new Date();

    return this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) return undefined;

      const data = snap.data();
      if (data.status !== 'reported' && data.status !== 'acknowledged') {
        throw fail(400, 'Only issues that have not been started can be assigned to an official');
      }

      const changes = {
        assigned_to: official.id,
        status: 'acknowledged',
        updated_at: now,
        // A different official means the previous serviceman choice no longer applies
        serviceman_id: data.assigned_to === official.id ? data.serviceman_id ?? null : null
      };

      transaction.update(ref, changes);
      transaction.set(ref.collection(HISTORY).doc(), {
        status: 'acknowledged',
        updated_by: assignedBy,
        notes: `Assigned to official: ${official.name}`,
        created_at: now
      });

      return formatIssue({ id: snap.id, ...data, ...changes });
    });
  }

  // The assigned official (or an admin) picks the serviceman who will do the work
  async assignServiceman(id, serviceman, actor) {
    const ref = this.ref(id);
    if (!ref) return undefined;

    const now = new Date();

    return this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) return undefined;

      const data = snap.data();
      if (!data.assigned_to) {
        throw fail(400, 'This issue has not been assigned to an official yet');
      }
      if (actor.role === 'official' && data.assigned_to !== actor.id) {
        throw fail(403, 'This issue is not assigned to you');
      }
      if (data.status !== 'acknowledged') {
        throw fail(400, 'A serviceman can only be chosen before work has started');
      }

      const changes = { serviceman_id: serviceman.id, updated_at: now };

      transaction.update(ref, changes);
      transaction.set(ref.collection(HISTORY).doc(), {
        status: 'acknowledged',
        updated_by: actor.id,
        notes: `Assigned to serviceman: ${serviceman.name}`,
        created_at: now
      });

      return formatIssue({ id: snap.id, ...data, ...changes });
    });
  }

  // Issues where the user is the assigned official or the assigned serviceman
  async findByAssignedOfficial(userId) {
    const id = String(userId);
    const [asOfficial, asServiceman] = await Promise.all([
      this.collection.where('assigned_to', '==', id).get(),
      this.collection.where('serviceman_id', '==', id).get()
    ]);

    const byId = new Map();
    [...asOfficial.docs, ...asServiceman.docs].forEach((doc) => byId.set(doc.id, { id: doc.id, ...doc.data() }));
    const issues = [...byId.values()];

    const rank = (status) => {
      const order = { acknowledged: 1, in_progress: 2, resolved: 3, verified: 4 };
      return order[status] || 5;
    };

    issues.sort((a, b) =>
      rank(a.status) - rank(b.status) ||
      (b.severity || 0) - (a.severity || 0) ||
      toMillis(a.created_at) - toMillis(b.created_at)
    );

    return this.attachUsers(issues, { includeReporterPhone: true });
  }

  async getStatusHistory(issueId) {
    const ref = this.ref(issueId);
    if (!ref) return [];

    const snap = await ref.collection(HISTORY).orderBy('created_at', 'asc').get();
    const entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const users = await this.userModel.findByIds(entries.map((entry) => entry.updated_by));

    return entries.map((entry) => {
      const user = users.get(entry.updated_by);
      return {
        id: entry.id,
        issue_id: ref.id,
        status: entry.status,
        updated_by: entry.updated_by ?? null,
        notes: entry.notes ?? null,
        created_at: toISO(entry.created_at),
        updated_by_name: user ? user.name : null,
        role: user ? user.role : null
      };
    });
  }

  async getAnalytics() {
    const snap = await this.collection.select('category', 'status', 'created_at', 'resolved_at').get();
    const issues = snap.docs.map((doc) => doc.data());

    const countBy = (field) => {
      const counts = new Map();
      issues.forEach((issue) => counts.set(issue[field], (counts.get(issue[field]) || 0) + 1));
      return [...counts.entries()].map(([value, count]) => ({ [field]: value, count }));
    };

    // "Resolved" covers both resolved (awaiting verification) and verified issues
    const isDone = (issue) => issue.status === 'resolved' || issue.status === 'verified';
    const resolved = issues.filter((issue) => isDone(issue) && issue.resolved_at);
    const totalHours = resolved.reduce(
      (sum, issue) => sum + (toMillis(issue.resolved_at) - toMillis(issue.created_at)) / 3600000,
      0
    );

    return {
      totalIssues: issues.length,
      resolvedIssues: issues.filter(isDone).length,
      avgResolutionTime: resolved.length ? totalHours / resolved.length : 0,
      issuesByCategory: countBy('category').sort((a, b) => b.count - a.count),
      issuesByStatus: countBy('status').sort(
        (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      )
    };
  }

  async getTrendData(months = 6) {
    const span = Math.min(Math.max(parseInt(months, 10) || 6, 1), 120);
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - span);

    const snap = await this.collection.where('created_at', '>=', since).select('status', 'created_at').get();

    const buckets = new Map();
    snap.docs.forEach((doc) => {
      const { status, created_at } = doc.data();
      const date = created_at.toDate();
      const key = date.getUTCFullYear() * 12 + date.getUTCMonth();
      const bucket = buckets.get(key) || { month: MONTHS[date.getUTCMonth()], issues: 0, resolved: 0 };
      bucket.issues += 1;
      if (status === 'resolved' || status === 'verified') bucket.resolved += 1;
      buckets.set(key, bucket);
    });

    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, bucket]) => bucket);
  }

  async getOfficialStats(userId) {
    const id = String(userId);
    const [asOfficial, asServiceman] = await Promise.all([
      this.collection.where('assigned_to', '==', id).get(),
      this.collection.where('serviceman_id', '==', id).get()
    ]);

    const byId = new Map();
    [...asOfficial.docs, ...asServiceman.docs].forEach((doc) => byId.set(doc.id, doc.data()));

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stats = { pending: 0, needsServiceman: 0, inProgress: 0, awaitingVerification: 0, resolvedThisWeek: 0 };

    byId.forEach(({ status, resolved_at, serviceman_id }) => {
      if (status === 'acknowledged' || status === 'reported') {
        stats.pending += 1;
        if (!serviceman_id) stats.needsServiceman += 1;
      } else if (status === 'in_progress') {
        stats.inProgress += 1;
      } else if (status === 'resolved') {
        stats.awaitingVerification += 1;
      }
      if ((status === 'resolved' || status === 'verified') && toMillis(resolved_at) >= weekAgo) {
        stats.resolvedThisWeek += 1;
      }
    });
    return stats;
  }
}

module.exports = Issue;
