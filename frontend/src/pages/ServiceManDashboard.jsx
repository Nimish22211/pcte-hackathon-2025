import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIssues } from '../context/IssueContext'
import { useAssignedIssues } from '../hooks/useAssignedIssues'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Hammer, MapPin, ClipboardList, Check, Clock, AlertTriangle, AlertCircle } from 'lucide-react'
import { getStatusColor } from '../utils/helpers'

const ON_DUTY_KEY = 'serviceman-on-duty'

const ServiceManDashboard = () => {
  const { user } = useAuth()
  const { updateIssueStatus } = useIssues()
  const { issues, stats, loading, refresh } = useAssignedIssues()
  const [onDuty, setOnDuty] = useState(() => localStorage.getItem(ON_DUTY_KEY) === 'true')

  const toggleDuty = () => {
    const next = !onDuty
    localStorage.setItem(ON_DUTY_KEY, String(next))
    setOnDuty(next)
  }

  const handleStatusUpdate = async (issueId, newStatus) => {
    const result = await updateIssueStatus(issueId, newStatus)
    if (result.success) await refresh()
  }

  const getPriorityColor = (severity) => {
    if (severity >= 4) return 'text-red-600'
    if (severity >= 3) return 'text-orange-600'
    return 'text-yellow-600'
  }

  const nextJob = issues.find((issue) => issue.status === 'acknowledged')
  const openJobs = issues.filter((issue) => issue.status === 'acknowledged' || issue.status === 'in_progress')

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Service Man Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {user?.department && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                  {user.department.replace('_', ' ')}
                </Badge>
              )}
              <Badge className={onDuty ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-700 border-gray-200'}>
                {onDuty ? 'On Duty' : 'Off Duty'}
              </Badge>
              <Button variant="outline" onClick={toggleDuty}>
                {onDuty ? 'End Shift' : 'Start Shift'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Jobs Waiting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? '—' : stats.pending}</div>
              <p className="text-xs text-gray-500">Assigned to you, not started</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Hammer className="h-5 w-5" /> In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? '—' : stats.inProgress}</div>
              <p className="text-xs text-gray-500">Working now</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Check className="h-5 w-5" /> Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? '—' : stats.resolvedThisWeek}</div>
              <p className="text-xs text-gray-500">This week</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" /> My Work Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[36rem] overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-gray-500">Loading work queue...</div>
                    </div>
                  ) : issues.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-gray-500">No jobs assigned yet. Your official will assign jobs to you.</div>
                    </div>
                  ) : (
                    issues.map((issue) => (
                      <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h4 className="font-medium text-sm">{issue.title}</h4>
                              <Badge className={getStatusColor(issue.status)}>
                                {issue.status.replace('_', ' ')}
                              </Badge>
                              {issue.severity >= 4 && issue.status !== 'verified' && (
                                <Badge className="bg-red-100 text-red-800">HIGH PRIORITY</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{issue.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {issue.address || 'Location not specified'}
                              </span>
                              <span className="flex items-center gap-1">
                                <AlertTriangle className={`h-3 w-3 ${getPriorityColor(issue.severity)}`} />
                                Priority: {issue.severity}/5
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(issue.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {issue.assigned_to_name && (
                              <p className="mt-2 text-xs text-gray-700">
                                Assigned by: <span className="font-medium">{issue.assigned_to_name}</span>
                              </p>
                            )}
                            {issue.status === 'resolved' && (
                              <p className="mt-2 text-xs text-green-700">Waiting for your official to verify the work</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            {issue.status === 'acknowledged' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(issue.id, 'in_progress')}
                                className="text-xs"
                                disabled={!onDuty}
                                title={onDuty ? undefined : 'Start your shift first'}
                              >
                                Start Job
                              </Button>
                            )}
                            {issue.status === 'in_progress' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(issue.id, 'resolved')}
                                className="text-xs bg-green-600 hover:bg-green-700"
                              >
                                Complete
                              </Button>
                            )}
                            <Link to={`/issue/${issue.id}`}>
                              <Button size="sm" variant="outline" className="text-xs w-full">
                                View Details
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
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={!onDuty || !nextJob}
                onClick={() => nextJob && handleStatusUpdate(nextJob.id, 'in_progress')}
              >
                <Hammer className="h-4 w-4 mr-2" />
                Start Next Job
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/report">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Report Issue
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/map">
                  <MapPin className="h-4 w-4 mr-2" />
                  View on Map
                </Link>
              </Button>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Summary</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Open jobs:</span>
                    <span>{openJobs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>In progress:</span>
                    <span>{stats.inProgress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed this week:</span>
                    <span>{stats.resolvedThisWeek}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ServiceManDashboard
