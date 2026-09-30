// Mirrors backend/config/workflow.js. The server enforces these rules; the UI only uses them
// to decide which buttons to show.

export const isAssignedOfficial = (user, issue) =>
  Boolean(user) && user.role === 'official' && issue.assigned_to === user.id

export const isAssignedServiceman = (user, issue) =>
  Boolean(user) && user.role === 'serviceman' && issue.serviceman_id === user.id

// Statuses the user can move this issue to
export const getAllowedStatuses = (user, issue) => {
  if (!user || !issue) return []

  if (user.role === 'admin') {
    return ['reported', 'acknowledged', 'in_progress', 'resolved', 'verified'].filter(
      (status) => status !== issue.status
    )
  }

  if (isAssignedOfficial(user, issue) && issue.status === 'resolved') {
    return ['verified', 'in_progress']
  }

  if (isAssignedServiceman(user, issue)) {
    if (issue.status === 'acknowledged') return ['in_progress']
    if (issue.status === 'in_progress') return ['resolved']
  }

  return []
}

// Button text for a status change, depending on the current status
export const getStatusActionLabel = (issue, status) => {
  if (issue.status === 'resolved' && status === 'in_progress') return 'Send back for rework'
  if (status === 'in_progress') return 'Start work'
  if (status === 'resolved') return 'Mark resolved'
  if (status === 'verified') return 'Verify work'
  if (status === 'acknowledged') return 'Acknowledged'
  return 'Reported'
}

// Who can choose the official / the serviceman for an issue right now
export const canAssignOfficial = (user, issue) =>
  Boolean(user) && user.role === 'admin' && (issue.status === 'reported' || issue.status === 'acknowledged')

export const canAssignServiceman = (user, issue) =>
  Boolean(user) &&
  Boolean(issue.assigned_to) &&
  issue.status === 'acknowledged' &&
  (user.role === 'admin' || isAssignedOfficial(user, issue))

// Staff on the issue can see internal notes and reporter contact details
export const canViewInternal = (user, issue) =>
  Boolean(user) && (user.role === 'admin' || isAssignedOfficial(user, issue) || isAssignedServiceman(user, issue))
