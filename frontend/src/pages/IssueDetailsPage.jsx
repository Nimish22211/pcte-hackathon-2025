import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIssues } from '../context/IssueContext'
import { apiService } from '../services/apiService'
import AssignSelect from '../components/Common/AssignSelect'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Phone,
  Mail,
  Camera,
  MessageSquare,
  UserCheck,
  Lock
} from 'lucide-react'
import { formatDate, getStatusColor, getSeverityColor } from '../utils/helpers'
import {
  getAllowedStatuses,
  getStatusActionLabel,
  canAssignOfficial,
  canAssignServiceman,
  canViewInternal
} from '../utils/workflow'

const IssueDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { fetchIssueById, fetchIssueHistory, updateIssueStatus, assignIssue, assignServiceman } = useIssues()

  const [issue, setIssue] = useState(null)
  const [history, setHistory] = useState([])
  const [people, setPeople] = useState({ officials: [], servicemen: [] })
  const [loading, setLoading] = useState(true)
  const [internalNotes, setInternalNotes] = useState('')
  const [updating, setUpdating] = useState(false)

  const loadIssue = async () => {
    const loaded = await fetchIssueById(id)
    setIssue(loaded)
    if (loaded && user) {
      setHistory(await fetchIssueHistory(id))
    } else {
      setHistory([])
    }
    return loaded
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await loadIssue()
      } catch (error) {
        console.error('Error loading issue:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, user?.id])

  const showAssignOfficial = issue && canAssignOfficial(user, issue)
  const showAssignServiceman = issue && canAssignServiceman(user, issue)

  // Load the people an admin / official can choose from
  useEffect(() => {
    const loadPeople = async () => {
      try {
        const [officials, servicemen] = await Promise.all([
          showAssignOfficial ? apiService.get('/users/officials') : { data: [] },
          showAssignServiceman ? apiService.get('/users/servicemen') : { data: [] }
        ])
        setPeople({ officials: officials.data, servicemen: servicemen.data })
      } catch (error) {
        console.error('Error loading people:', error)
      }
    }
    if (showAssignOfficial || showAssignServiceman) loadPeople()
  }, [showAssignOfficial, showAssignServiceman])

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true)
    try {
      const result = await updateIssueStatus(id, newStatus, internalNotes.trim() || null)
      if (result.success) {
        setInternalNotes('')
        await loadIssue()
      }
    } finally {
      setUpdating(false)
    }
  }

  const handleAssignOfficial = async (officialId) => {
    const result = await assignIssue(id, officialId)
    if (result.success) await loadIssue()
    return result
  }

  const handleAssignServiceman = async (servicemanId) => {
    const result = await assignServiceman(id, servicemanId)
    if (result.success) await loadIssue()
    return result
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Issue Not Found</h1>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const allowedStatuses = getAllowedStatuses(user, issue)
  const isStaff = canViewInternal(user, issue)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{issue.title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Issue Details */}
            <Card>
              <CardHeader>
                <CardTitle>Issue Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{issue.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Category</h4>
                    <p className="text-sm">{issue.category}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Severity</h4>
                    <Badge className={getSeverityColor(issue.severity)}>
                      {issue.severity}/5
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                    <Badge className={getStatusColor(issue.status)}>
                      {issue.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Reported</h4>
                    <p className="text-sm">{formatDate(issue.created_at)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Official in charge</h4>
                    <p className="text-sm">{issue.assigned_to_name || 'Not assigned yet'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Serviceman</h4>
                    <p className="text-sm">{issue.serviceman_name || 'Not assigned yet'}</p>
                  </div>
                </div>

                {issue.address && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Location</h4>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="text-sm">{issue.address}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photos */}
            {issue.photos && issue.photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Camera className="h-5 w-5" />
                    <span>Photos</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {issue.photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo.url}
                          alt={`Issue photo ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Internal notes: staff on this issue only */}
            {isStaff && issue.internal_notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lock className="h-5 w-5" />
                    <span>Internal Notes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.internal_notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Reporter Information (only sent by the server to staff on this issue) */}
            {issue.reported_by_name && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Reporter Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Name</h4>
                    <p className="text-sm">{issue.reported_by_name}</p>
                  </div>
                  {issue.reported_by_email && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Email</h4>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <p className="text-sm">{issue.reported_by_email}</p>
                      </div>
                    </div>
                  )}
                  {issue.reported_by_phone && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Phone</h4>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <p className="text-sm">{issue.reported_by_phone}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Admin: choose the official */}
            {showAssignOfficial && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <UserCheck className="h-5 w-5" />
                    <span>{issue.assigned_to ? 'Reassign Official' : 'Assign Official'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AssignSelect
                    options={people.officials.filter((official) => official.id !== issue.assigned_to)}
                    onAssign={handleAssignOfficial}
                    placeholder="Choose official..."
                    emptyMessage="No other officials available."
                  />
                </CardContent>
              </Card>
            )}

            {/* Official: choose the serviceman */}
            {showAssignServiceman && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <UserCheck className="h-5 w-5" />
                    <span>{issue.serviceman_id ? 'Change Serviceman' : 'Choose Serviceman'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AssignSelect
                    options={people.servicemen.filter((serviceman) => serviceman.id !== issue.serviceman_id)}
                    onAssign={handleAssignServiceman}
                    placeholder="Choose serviceman..."
                    emptyMessage="No servicemen available for this department."
                  />
                </CardContent>
              </Card>
            )}

            {/* Status Update: only the actions this user may take */}
            {allowedStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>Update Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Internal Notes
                    </label>
                    <Textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Add internal notes (not visible to citizens)"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    {allowedStatuses.map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        onClick={() => handleStatusUpdate(status)}
                        disabled={updating}
                        className="w-full justify-start"
                      >
                        {getStatusActionLabel(issue, status)}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Issue Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.length > 0 ? (
                    history.map((entry) => (
                      <div key={entry.id} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm font-medium capitalize">{entry.status.replace('_', ' ')}</p>
                          {entry.notes && <p className="text-xs text-gray-600">{entry.notes}</p>}
                          <p className="text-xs text-gray-500">
                            {formatDate(entry.created_at)}
                            {entry.updated_by_name ? ` · ${entry.updated_by_name}` : ''}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm font-medium">Issue Reported</p>
                          <p className="text-xs text-gray-500">{formatDate(issue.created_at)}</p>
                        </div>
                      </div>
                      {issue.assigned_to_name && (
                        <div className="flex items-start space-x-3">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                          <div>
                            <p className="text-sm font-medium">Assigned to Official</p>
                            <p className="text-xs text-gray-500">{issue.assigned_to_name}</p>
                          </div>
                        </div>
                      )}
                      {issue.resolved_at && (
                        <div className="flex items-start space-x-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                          <div>
                            <p className="text-sm font-medium">Resolved</p>
                            <p className="text-xs text-gray-500">{formatDate(issue.resolved_at)}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IssueDetailsPage
