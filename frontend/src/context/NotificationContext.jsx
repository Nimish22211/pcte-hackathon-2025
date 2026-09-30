import { createContext, useContext, useReducer, useEffect } from 'react'
import { socketService } from '../services/socketService'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const NotificationContext = createContext()

const initialState = {
  notifications: [],
  unreadCount: 0
}

const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: state.unreadCount + 1
      }
    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload
            ? { ...notification, read: true }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }
    case 'MARK_ALL_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification => ({
          ...notification,
          read: true
        })),
        unreadCount: 0
      }
    case 'REMOVE_NOTIFICATION':
      const notification = state.notifications.find(n => n.id === action.payload)
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
        unreadCount: notification && !notification.read 
          ? Math.max(0, state.unreadCount - 1) 
          : state.unreadCount
      }
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        unreadCount: action.payload.filter(n => !n.read).length
      }
    default:
      return state
  }
}

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    // Listen for real-time notifications
    socketService.on('notification', (notification) => {
      const newNotification = {
        id: Date.now() + Math.random(),
        ...notification,
        timestamp: new Date().toISOString(),
        read: false
      }
      
      dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification })
      
      // Show toast notification
      toast.success(notification.message, {
        duration: 4000,
        icon: getNotificationIcon(notification.type)
      })
    })

    // Reconnect so the server knows who this socket belongs to (needed for private rooms)
    socketService.reconnect()

    // Join user-specific notification room
    socketService.emit('join-room', `user-${user.id}`)

    // Admins and officials are notified when new issues are reported
    const isStaff = user.role === 'admin' || user.role === 'official'
    if (isStaff) {
      socketService.emit('join-room', 'admin-notifications')
    }

    return () => {
      socketService.off('notification')
      socketService.emit('leave-room', `user-${user.id}`)
      if (isStaff) {
        socketService.emit('leave-room', 'admin-notifications')
      }
    }
  }, [user?.id, user?.role])

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'issue_assigned':
        return '👤'
      case 'issue_status_changed':
        return '🔄'
      case 'issue_created':
        return '📍'
      case 'issue_resolved':
        return '✅'
      case 'system':
        return '🔔'
      default:
        return '💬'
    }
  }

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      ...notification,
      timestamp: new Date().toISOString(),
      read: false
    }
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification })
  }

  const markAsRead = (id) => {
    dispatch({ type: 'MARK_AS_READ', payload: id })
  }

  const markAllAsRead = () => {
    dispatch({ type: 'MARK_ALL_AS_READ' })
  }

  const removeNotification = (id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })
  }

  const value = {
    ...state,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
