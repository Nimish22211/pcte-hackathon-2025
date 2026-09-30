// Issue workflow
//
//   reported --(admin assigns an official)--> acknowledged
//   acknowledged --(official picks a serviceman; status stays acknowledged)
//   acknowledged --(serviceman starts work)--> in_progress
//   in_progress  --(serviceman completes)-----> resolved
//   resolved     --(official verifies)--------> verified
//   resolved     --(official sends back)------> in_progress
//
// Admins can move an issue to any status.

const isAdmin = (user) => user.role === 'admin';
const isAssignedOfficial = (user, issue) => user.role === 'official' && issue.assigned_to === user.id;
const isAssignedServiceman = (user, issue) => user.role === 'serviceman' && issue.serviceman_id === user.id;

// Staff who may see internal notes and reporter contact details of an issue
const canViewInternal = (user, issue) =>
  Boolean(user) && (isAdmin(user) || isAssignedOfficial(user, issue) || isAssignedServiceman(user, issue));

// Returns null when the change is allowed, otherwise { status, message }
const checkStatusChange = (user, issue, newStatus) => {
  if (issue.status === newStatus) {
    return { status: 400, message: `Issue is already ${newStatus.replace('_', ' ')}` };
  }

  if (isAdmin(user)) return null;

  if (user.role === 'official') {
    if (!isAssignedOfficial(user, issue)) {
      return { status: 403, message: 'This issue is not assigned to you' };
    }
    if (issue.status === 'resolved' && (newStatus === 'verified' || newStatus === 'in_progress')) {
      return null;
    }
    return { status: 403, message: 'Officials can only verify resolved work or send it back for rework. Work is done by the assigned serviceman.' };
  }

  if (user.role === 'serviceman') {
    if (!isAssignedServiceman(user, issue)) {
      return { status: 403, message: 'This job is not assigned to you' };
    }
    if (
      (issue.status === 'acknowledged' && newStatus === 'in_progress') ||
      (issue.status === 'in_progress' && newStatus === 'resolved')
    ) {
      return null;
    }
    return { status: 403, message: 'Servicemen can only start an assigned job or mark it resolved' };
  }

  return { status: 403, message: 'You are not allowed to change the status of issues' };
};

module.exports = { canViewInternal, checkStatusChange, isAssignedOfficial, isAssignedServiceman };

// Removes internal fields for people who may not see them:
//  - staff on the issue (admin, assigned official, assigned serviceman): everything
//  - the reporter: no internal notes or contact details
//  - everyone else: also no reporter identity
const presentIssue = (issue, user) => {
  if (canViewInternal(user, issue)) return issue;

  const { internal_notes, reported_by_email, reported_by_phone, ...publicIssue } = issue;
  if (user && issue.reported_by === user.id) return publicIssue;

  const { reported_by_name, ...anonymous } = publicIssue;
  return anonymous;
};

// History entries: notes and people are only for staff on the issue
const presentHistory = (entries, issue, user) => {
  if (canViewInternal(user, issue)) return entries;
  return entries.map(({ notes, updated_by, updated_by_name, role, ...entry }) => entry);
};

module.exports.presentIssue = presentIssue;
module.exports.presentHistory = presentHistory;
