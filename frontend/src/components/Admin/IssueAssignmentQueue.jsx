import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIssues } from '../../context/IssueContext'
import { apiService } from '../../services/apiService'
import AssignSelect from '../Common/AssignSelect'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { UserCheck } from 'lucide-react'
import { getStatusColor } from '../../utils/helpers'

// Issues that have not been started yet: the admin chooses (or changes) the responsible official
const IssueAssignmentQueue = () => {
  const { issues, assignIssue, fetchIssues } = useIssues()
  const [officials, setOfficials] = useState([])

  useEffect(() => {
    fetchIssues()

    const loadOfficials = async () => {
      try {
        const response = await apiService.get('/users/officials')
        setOfficials(response.data)
      } catch (error) {
        console.error('Error loading officials:', error)
      }
    }
    loadOfficials()
  }, [])

  const queue = issues
    .filter((issue) => issue.status === 'reported' || issue.status === 'acknowledged')
    // Unassigned first, then most severe
    .sort((a, b) => Number(Boolean(a.assigned_to)) - Number(Boolean(b.assigned_to)) || b.severity - a.severity)

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Issue Assignment
          <Badge variant="outline" className="ml-2">{queue.filter((i) => !i.assigned_to).length} unassigned</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <p className="text-sm text-gray-500">All issues have been picked up.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {queue.map((issue) => (
              <div key={issue.id} className="flex flex-col gap-3 border rounded-lg p-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/issue/${issue.id}`} className="font-medium text-sm hover:underline">
                      {issue.title}
                    </Link>
                    <Badge className={getStatusColor(issue.status)}>{issue.status.replace('_', ' ')}</Badge>
                    <span className="text-xs text-gray-500">Severity {issue.severity}/5</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{issue.address || 'Location not specified'}</p>
                  {issue.assigned_to_name && (
                    <p className="text-xs text-gray-700">
                      Official: <span className="font-medium">{issue.assigned_to_name}</span>
                      {issue.serviceman_name ? ` · Serviceman: ${issue.serviceman_name}` : ' · no serviceman yet'}
                    </p>
                  )}
                </div>
                <div className="md:w-72">
                  <AssignSelect
                    options={officials.filter((official) => official.id !== issue.assigned_to)}
                    onAssign={(officialId) => assignIssue(issue.id, officialId)}
                    placeholder={issue.assigned_to ? 'Reassign official...' : 'Choose official...'}
                    buttonLabel={issue.assigned_to ? 'Reassign' : 'Assign'}
                    emptyMessage="No officials yet. Appoint one in User Management below."
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default IssueAssignmentQueue
