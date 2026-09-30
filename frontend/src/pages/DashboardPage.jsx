import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIssues } from '../context/IssueContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { AlertCircle, Calendar, CheckCircle, Clock, Eye, MapPin, Plus, Star, Wrench } from 'lucide-react'
import { formatDate, getStatusColor } from '../utils/helpers'
import { ISSUE_STATUSES } from '../utils/constants'

const ROLE_HOME = {
  admin: '/admin/dashboard',
  official: '/official/dashboard',
  serviceman: '/serviceman/dashboard'
}

const getSeverityColor = (severity) => {
  if (severity >= 4) return 'text-red-500'
  if (severity >= 3) return 'text-orange-500'
  return 'text-green-500'
}

// Citizen dashboard: the issues I reported and how far along they are
const DashboardPage = () => {
  const { user } = useAuth()
  const { issues, loading, fetchIssues } = useIssues()
  const [selectedStatus, setSelectedStatus] = useState('all')

  useEffect(() => {
    if (user?.id && user.role === 'citizen') {
      fetchIssues({ reported_by: user.id })
    }
  }, [user?.id])

  // Staff have their own dashboards
  if (user && ROLE_HOME[user.role]) {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }

  // Live events can add other people's issues to the shared list, so keep only mine
  const myIssues = issues.filter((issue) => issue.reported_by === user?.id)
  const filteredIssues =
    selectedStatus === 'all' ? myIssues : myIssues.filter((issue) => issue.status === selectedStatus)

  const counts = {
    total: myIssues.length,
    open: myIssues.filter((issue) => issue.status === 'reported' || issue.status === 'acknowledged').length,
    inProgress: myIssues.filter((issue) => issue.status === 'in_progress').length,
    resolved: myIssues.filter((issue) => issue.status === 'resolved' || issue.status === 'verified').length
  }

  const stats = [
    { label: 'My Reports', value: counts.total, icon: AlertCircle, tint: 'bg-blue-100 text-blue-600' },
    { label: 'Waiting', value: counts.open, icon: Clock, tint: 'bg-orange-100 text-orange-600' },
    { label: 'In Progress', value: counts.inProgress, icon: Wrench, tint: 'bg-purple-100 text-purple-600' },
    { label: 'Resolved', value: counts.resolved, icon: CheckCircle, tint: 'bg-green-100 text-green-600' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="bg-white/70 backdrop-blur-xl shadow-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-blue-900">
                My Dashboard
              </h1>
              <p className="text-slate-600 font-medium">
                Welcome back, <span className="text-blue-600">{user?.name}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                aria-label="Filter by status"
              >
                <option value="all">All my reports</option>
                {ISSUE_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              <Button asChild>
                <Link to="/report">
                  <Plus className="h-4 w-4 mr-2" />
                  Report Issue
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map(({ label, value, icon: Icon, tint }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600">{label}</CardTitle>
                <div className={`p-2 rounded-xl ${tint}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{loading ? '—' : value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
            <CardTitle className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <span>My Reported Issues</span>
              <Badge className="bg-blue-100 text-blue-800 border border-blue-200 ml-auto">
                {filteredIssues.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredIssues.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {filteredIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issue/${issue.id}`}
                    className="block p-6 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-slate-900">{issue.title}</h3>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < issue.severity ? getSeverityColor(issue.severity) : 'text-gray-300'} fill-current`}
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-slate-600 text-sm leading-relaxed mb-3">
                          {issue.description.length > 120 ? `${issue.description.substring(0, 120)}...` : issue.description}
                        </p>

                        <div className="flex items-center flex-wrap gap-3 text-xs">
                          <Badge className="bg-slate-100 text-slate-700 border border-slate-200">{issue.category}</Badge>
                          <div className="flex items-center text-slate-500">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(issue.created_at)}
                          </div>
                          {issue.photos && issue.photos.length > 0 && (
                            <div className="flex items-center text-slate-500">
                              <Eye className="w-3 h-3 mr-1" />
                              {issue.photos.length} photo{issue.photos.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2 text-right">
                        <Badge className={`${getStatusColor(issue.status)} font-medium`}>
                          {issue.status.replace('_', ' ')}
                        </Badge>
                        {issue.assigned_to_name && (
                          <div className="text-xs text-slate-500">Official: {issue.assigned_to_name}</div>
                        )}
                        {issue.serviceman_name && (
                          <div className="text-xs text-slate-500">Serviceman: {issue.serviceman_name}</div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">
                  {myIssues.length === 0 ? "You haven't reported any issues yet" : 'No issues with this status'}
                </p>
                {myIssues.length === 0 && (
                  <Button asChild className="mt-4">
                    <Link to="/report">Report your first issue</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardPage
