import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIssues } from '../context/IssueContext'
import { useAssignedIssues } from '../hooks/useAssignedIssues'
import { apiService } from '../services/apiService'
import AssignSelect from '../components/Common/AssignSelect'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { MapPin, CheckCircle, AlertTriangle, ClipboardCheck, Wrench, Eye, Clock, UserPlus, ShieldCheck, Undo2 } from 'lucide-react'
import { getStatusColor } from '../utils/helpers'

const OfficialDashboard = () => {
  const { user } = useAuth()
  const { updateIssueStatus, assignServiceman } = useIssues()
  const { issues, stats, loading, refresh } = useAssignedIssues()
  const [servicemen, setServicemen] = useState([])

  // Only servicemen of the official's own department are offered
  useEffect(() => {
    const loadServicemen = async () => {
      try {
        const response = await apiService.get('/users/servicemen')
        setServicemen(response.data)
      } catch (error) {
        console.error('Error loading servicemen:', error)
      }
    }
    loadServicemen()
  }, [])

  const handleAssignServiceman = async (issueId, servicemanId) => {
    const result = await assignServiceman(issueId, servicemanId)
    if (result.success) await refresh()
    return result
  }

  const handleStatusUpdate = async (issueId, newStatus) => {
    const result = await updateIssueStatus(issueId, newStatus)
    if (result.success) await refresh()
  }

  const getSeverityColor = (severity) => {
    if (severity >= 4) return 'text-red-600'
    if (severity >= 3) return 'text-orange-600'
    return 'text-yellow-600'
  }

  const needsAttention = issues.filter(
    (issue) =>
      issue.status === 'resolved' ||
      (issue.status === 'acknowledged' && !issue.serviceman_id) ||
      (issue.severity >= 4 && issue.status !== 'verified')
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Official Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {user?.department && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                  {user.department.replace('_', ' ')}
                </Badge>
              )}
              <Button variant="outline" asChild>
                <Link to="/map">View Map</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Needs Serviceman</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? '—' : stats.needsServiceman}</div>
              <p className="text-xs text-gray-500">Choose who does the work</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? '—' : stats.inProgress}</div>
              <p className="text-xs text-gray-500">Servicemen are working</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> To Verify</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? '—' : stats.awaitingVerification}</div>
              <p className="text-xs text-gray-500">Work completed, awaiting your check</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Resolved This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? '—' : stats.resolvedThisWeek}</div>
              <p className="text-xs text-gray-500">Resolved or verified</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" /> My Assigned Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[36rem] overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-gray-500">Loading assigned issues...</div>
                    </div>
                  ) : issues.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-gray-500">No issues assigned to you yet</div>
                    </div>
                  ) : (
                    issues.map((issue) => (
                      <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h4 className="font-medium text-sm">{issue.title}</h4>
                              <Badge className={getStatusColor(issue.status)}>
                                {issue.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{issue.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {issue.address || 'Location not specified'}
                              </span>
                              <span className="flex items-center gap-1">
                                <AlertTriangle className={`h-3 w-3 ${getSeverityColor(issue.severity)}`} />
                                Severity: {issue.severity}/5
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(issue.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {issue.serviceman_name && (
                              <p className="mt-2 text-xs text-gray-700">
                                Serviceman: <span className="font-medium">{issue.serviceman_name}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 md:w-64">
                            {issue.status === 'acknowledged' && (
                              <AssignSelect
                                options={servicemen.filter((s) => s.id !== issue.serviceman_id)}
                                onAssign={(servicemanId) => handleAssignServiceman(issue.id, servicemanId)}
                                placeholder={issue.serviceman_id ? 'Change serviceman...' : 'Choose serviceman...'}
                                buttonLabel={issue.serviceman_id ? 'Change' : 'Assign'}
                                emptyMessage="No servicemen available in your department. Ask an admin to add one."
                              />
                            )}
                            {issue.status === 'in_progress' && (
                              <p className="text-xs text-blue-700">Work in progress</p>
                            )}
                            {issue.status === 'resolved' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="text-xs flex-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => handleStatusUpdate(issue.id, 'verified')}
                                >
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs flex-1"
                                  onClick={() => handleStatusUpdate(issue.id, 'in_progress')}
                                >
                                  <Undo2 className="h-3 w-3 mr-1" />
                                  Rework
                                </Button>
                              </div>
                            )}
                            {issue.status === 'verified' && (
                              <p className="text-xs text-purple-700">Verified and closed</p>
                            )}
                            <Link to={`/issue/${issue.id}`}>
                              <Button size="sm" variant="outline" className="text-xs w-full">
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Needs Your Attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {needsAttention.length === 0 ? (
                <div className="p-3 border rounded-md bg-green-50 text-green-800 text-sm">
                  Nothing needs your attention right now
                </div>
              ) : (
                needsAttention.slice(0, 5).map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issue/${issue.id}`}
                    className="block p-3 border rounded-md bg-amber-50 text-amber-800 text-sm hover:bg-amber-100"
                  >
                    {issue.status === 'resolved'
                      ? 'Verify work: '
                      : issue.status === 'acknowledged' && !issue.serviceman_id
                        ? 'Choose a serviceman: '
                        : 'High severity: '}
                    {issue.title}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default OfficialDashboard
