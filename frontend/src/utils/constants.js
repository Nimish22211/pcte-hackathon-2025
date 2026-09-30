export const ISSUE_CATEGORIES = [
  { value: 'pothole', label: 'Pothole', icon: '🚧' },
  { value: 'streetlight', label: 'Street Light', icon: '💡' },
  { value: 'graffiti', label: 'Graffiti', icon: '🎨' },
  { value: 'waste', label: 'Waste Management', icon: '🗑️' },
  { value: 'sewage', label: 'Sewage', icon: '🚰' },
  { value: 'road', label: 'Road Issues', icon: '🛣️' },
  { value: 'other', label: 'Other', icon: '📋' }
]

export const ISSUE_STATUSES = [
  { value: 'reported', label: 'Reported', color: 'red' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'yellow' },
  { value: 'in_progress', label: 'In Progress', color: 'blue' },
  { value: 'resolved', label: 'Resolved', color: 'green' },
  { value: 'verified', label: 'Verified', color: 'purple' }
]

export const SEVERITY_LEVELS = [
  { value: 1, label: 'Low', description: 'Minor inconvenience' },
  { value: 2, label: 'Low-Medium', description: 'Noticeable issue' },
  { value: 3, label: 'Medium', description: 'Moderate impact' },
  { value: 4, label: 'High', description: 'Significant impact' },
  { value: 5, label: 'Critical', description: 'Safety hazard' }
]

export const USER_ROLES = {
  CITIZEN: 'citizen',
  OFFICIAL: 'official',
  ADMIN: 'admin',
  SERVICE_MAN: 'serviceman'
}

export const DEPARTMENTS = [
  { value: 'public_works', label: 'Public Works' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'parks', label: 'Parks & Recreation' },
  { value: 'sewage', label: 'Sewage' },
  { value: 'maintenance', label: 'Maintenance' }
]

export const MAP_DEFAULTS = {
  center: [30.9090, 75.8516], // Ludhiana, Punjab, India
  zoom: 13,
  maxZoom: 18,
  minZoom: 10
}
