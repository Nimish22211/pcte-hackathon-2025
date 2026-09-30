import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIssues } from '../context/IssueContext'
import { useNotifications } from '../context/NotificationContext'

const EMPTY_STATS = { pending: 0, needsServiceman: 0, inProgress: 0, awaitingVerification: 0, resolvedThisWeek: 0 }

// Loads the issues assigned to the logged-in official / serviceman plus their stats,
// and refreshes them whenever a new notification arrives.
export const useAssignedIssues = () => {
  const { user } = useAuth()
  const { fetchAssignedIssues, fetchOfficialStats } = useIssues()
  const { notifications } = useNotifications()
  const [issues, setIssues] = useState([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    const [assigned, userStats] = await Promise.all([fetchAssignedIssues(user.id), fetchOfficialStats(user.id)])
    setIssues(assigned)
    setStats({ ...EMPTY_STATS, ...userStats })
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    refresh()
  }, [refresh, notifications[0]?.id])

  return { issues, stats, loading, refresh }
}
