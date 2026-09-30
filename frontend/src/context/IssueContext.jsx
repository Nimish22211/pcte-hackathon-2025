import { createContext, useContext, useReducer, useEffect } from 'react'
import { apiService } from '../services/apiService'
import { socketService } from '../services/socketService'
import toast from 'react-hot-toast'

const IssueContext = createContext()

const initialState = {
  issues: [],
  loading: false,
  filters: {
    category: 'all',
    status: 'all',
    severity: null,
    assigned_to: null
  },
  selectedIssue: null,
  analytics: null
}

const issueReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ISSUES':
      return { ...state, issues: action.payload, loading: false }
    case 'ADD_ISSUE':
      // The creator receives the issue from both the API response and the socket event
      if (state.issues.some(issue => issue.id === action.payload.id)) return state
      return { ...state, issues: [action.payload, ...state.issues] }
    case 'UPDATE_ISSUE':
      return {
        ...state,
        issues: state.issues.map(issue =>
          issue.id === action.payload.id ? action.payload : issue
        )
      }
    case 'SET_SELECTED_ISSUE':
      return { ...state, selectedIssue: action.payload }
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } }
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload }
    default:
      return state
  }
}

export const IssueProvider = ({ children }) => {
  const [state, dispatch] = useReducer(issueReducer, initialState)

  // Initialize Socket.IO connection and listeners
  useEffect(() => {
    socketService.connect()

    // Listen for real-time issue updates
    socketService.on('issue-created', (issue) => {
      dispatch({ type: 'ADD_ISSUE', payload: issue })
      toast.success(`New issue reported: ${issue.title}`, {
        duration: 3000,
        icon: '📍'
      })
    })

    socketService.on('issue-updated', (issue) => {
      dispatch({ type: 'UPDATE_ISSUE', payload: issue })
      toast.success(`Issue updated: ${issue.title}`, {
        duration: 3000,
        icon: '🔄'
      })
    })

    socketService.on('issue-status-changed', (data) => {
      dispatch({ type: 'UPDATE_ISSUE', payload: data.issue })
      toast.success(`Issue status changed to: ${data.issue.status}`, {
        duration: 3000,
        icon: '✅'
      })
    })

    socketService.on('issue-assigned', (data) => {
      dispatch({ type: 'UPDATE_ISSUE', payload: data.issue })
      toast.success(`Issue assigned to: ${data.assignedTo}`, {
        duration: 3000,
        icon: '👤'
      })
    })

    // Join the issues room for real-time updates
    socketService.emit('join-room', 'issues')

    return () => {
      socketService.off('issue-created')
      socketService.off('issue-updated')
      socketService.off('issue-status-changed')
      socketService.off('issue-assigned')
      socketService.emit('leave-room', 'issues')
      socketService.disconnect()
    }
  }, [])

  const fetchIssues = async (filters = {}) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const response = await apiService.get('/issues', { params: filters })
      dispatch({ type: 'SET_ISSUES', payload: response.data })
    } catch (error) {
      console.error('Error fetching issues:', error)
      toast.error('Failed to fetch issues')
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const fetchIssueById = async (id) => {
    try {
      const response = await apiService.get(`/issues/${id}`)
      dispatch({ type: 'SET_SELECTED_ISSUE', payload: response.data })
      return response.data
    } catch (error) {
      console.error('Error fetching issue:', error)
      toast.error('Failed to fetch issue details')
      return null
    }
  }

  const createIssue = async (issueData) => {
    try {
      const response = await apiService.post('/issues', issueData)
      dispatch({ type: 'ADD_ISSUE', payload: response.data })
      toast.success('Issue reported successfully!')
      return { success: true, issue: response.data }
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create issue'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const updateIssueStatus = async (id, status, internalNotes = null) => {
    try {
      const response = await apiService.put(`/issues/${id}/status`, {
        status,
        internal_notes: internalNotes
      })
      dispatch({ type: 'UPDATE_ISSUE', payload: response.data })
      toast.success('Issue status updated successfully!')
      return { success: true, issue: response.data }
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update issue status'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const assignIssue = async (id, officialId) => {
    try {
      const response = await apiService.put(`/issues/${id}/assign`, {
        assigned_to: officialId
      })
      dispatch({ type: 'UPDATE_ISSUE', payload: response.data })
      toast.success('Issue assigned successfully!')
      return { success: true, issue: response.data }
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to assign issue'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const assignServiceman = async (id, servicemanId) => {
    try {
      const response = await apiService.put(`/issues/${id}/assign-serviceman`, {
        serviceman_id: servicemanId
      })
      dispatch({ type: 'UPDATE_ISSUE', payload: response.data })
      toast.success('Serviceman assigned successfully!')
      return { success: true, issue: response.data }
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to assign serviceman'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const fetchAnalytics = async () => {
    try {
      const response = await apiService.get('/issues/analytics')
      dispatch({ type: 'SET_ANALYTICS', payload: response.data })
      return response.data
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to fetch analytics')
      return null
    }
  }

  // Returns the issues assigned to the user (as official or serviceman) without touching the shared issue list
  const fetchAssignedIssues = async (officialId) => {
    try {
      const response = await apiService.get(`/issues/assigned/${officialId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching assigned issues:', error)
      toast.error('Failed to fetch assigned issues')
      return []
    }
  }

  const fetchIssueHistory = async (issueId) => {
    try {
      const response = await apiService.get(`/issues/${issueId}/history`)
      return response.data
    } catch (error) {
      console.error('Error fetching issue history:', error)
      toast.error('Failed to fetch issue history')
      return []
    }
  }

  const fetchTrendData = async (months = 6) => {
    try {
      const response = await apiService.get(`/issues/trends?months=${months}`)
      return response.data
    } catch (error) {
      console.error('Error fetching trend data:', error)
      toast.error('Failed to fetch trend data')
      return []
    }
  }

  const fetchOfficialStats = async (officialId) => {
    try {
      const response = await apiService.get(`/issues/official-stats/${officialId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching official stats:', error)
      toast.error('Failed to fetch official statistics')
      return { pending: 0, needsServiceman: 0, inProgress: 0, awaitingVerification: 0, resolvedThisWeek: 0 }
    }
  }

  const setFilters = (filters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }

  const clearFilters = () => {
    dispatch({ type: 'SET_FILTERS', payload: initialState.filters })
  }

  const value = {
    ...state,
    fetchIssues,
    fetchIssueById,
    createIssue,
    updateIssueStatus,
    assignIssue,
    assignServiceman,
    fetchAnalytics,
    fetchAssignedIssues,
    fetchIssueHistory,
    fetchTrendData,
    fetchOfficialStats,
    setFilters,
    clearFilters
  }

  return (
    <IssueContext.Provider value={value}>
      {children}
    </IssueContext.Provider>
  )
}

export const useIssues = () => {
  const context = useContext(IssueContext)
  if (!context) {
    throw new Error('useIssues must be used within an IssueProvider')
  }
  return context
}
