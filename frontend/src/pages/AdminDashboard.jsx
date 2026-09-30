import { useAuth } from '../context/AuthContext'
import { useIssues } from '../context/IssueContext'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { AlertCircle, Clock, BarChart3, Database, Shield, TrendingUp } from 'lucide-react'
import IssueAssignmentQueue from '../components/Admin/IssueAssignmentQueue'
import UserManagement from '../components/Admin/UserManagement'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'

const StatCard = ({ title, value, icon: Icon }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">Updated just now</p>
    </CardContent>
  </Card>
)

const AdminDashboard = () => {
  const { user } = useAuth()
  const { analytics, fetchAnalytics, fetchTrendData, issues } = useIssues()
  const [loading, setLoading] = useState(true)
  const [trendData, setTrendData] = useState([])

  const loadData = async () => {
    setLoading(true)
    try {
      await fetchAnalytics()
      const trends = await fetchTrendData(6)
      setTrendData(trends)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Process data for charts
  const categoryData = analytics?.issuesByCategory?.map(item => ({
    name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
    value: parseInt(item.count),
    fill: getColorForCategory(item.category)
  })) || []

  const statusData = analytics?.issuesByStatus?.map(item => ({
    name: item.status.replace('_', ' ').toUpperCase(),
    value: parseInt(item.count),
    fill: getColorForStatus(item.status)
  })) || []

  // Real trend data from backend

  function getColorForCategory(category) {
    const colors = {
      pothole: '#ef4444',
      streetlight: '#f59e0b',
      graffiti: '#8b5cf6',
      waste: '#10b981',
      sewage: '#3b82f6',
      road: '#f97316',
      other: '#6b7280'
    }
    return colors[category] || '#6b7280'
  }

  function getColorForStatus(status) {
    const colors = {
      reported: '#ef4444',
      acknowledged: '#f59e0b',
      in_progress: '#3b82f6',
      resolved: '#10b981',
      verified: '#8b5cf6'
    }
    return colors[status] || '#6b7280'
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">LIVE</Badge>
              <Button variant="outline" onClick={loadData} disabled={loading}>Sync Data</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Issues"
            value={loading ? '—' : analytics?.totalIssues?.toLocaleString() || '0'}
            icon={AlertCircle}
          />
          <StatCard
            title="Resolved Issues"
            value={loading ? '—' : analytics?.resolvedIssues?.toLocaleString() || '0'}
            icon={Shield}
          />
          <StatCard
            title="Resolution Rate"
            value={loading ? '—' : analytics?.totalIssues ? `${Math.round((analytics.resolvedIssues / analytics.totalIssues) * 100)}%` : '0%'}
            icon={TrendingUp}
          />
          <StatCard
            title="Avg Resolution Time"
            value={loading ? '—' : analytics?.avgResolutionTime ? `${Math.round(analytics.avgResolutionTime)}h` : '—'}
            icon={Clock}
          />
        </div>

        {/* Assign reported issues to officials */}
        <IssueAssignmentQueue />

        {/* Appoint and manage officials, servicemen and admins */}
        <UserManagement />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Issues by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Issues by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Issues by Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Issues by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Trend Analysis */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Issue Trends (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="issues" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                <Area type="monotone" dataKey="resolved" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {issues.slice(0, 5).map((issue) => (
                <div key={issue.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      issue.status === 'reported' ? 'bg-red-500' :
                      issue.status === 'acknowledged' ? 'bg-yellow-500' :
                      issue.status === 'in_progress' ? 'bg-blue-500' :
                      issue.status === 'resolved' ? 'bg-green-500' :
                      'bg-purple-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-sm">{issue.title}</p>
                      <p className="text-xs text-gray-500">{issue.category} • {issue.address}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {issue.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminDashboard