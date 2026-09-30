import { io } from 'socket.io-client'
import { auth } from '../lib/firebase'

class SocketService {
  constructor() {
    this.socket = null
    this.connected = false
    this.rooms = new Set()
  }

  connect() {
    if (this.socket) {
      return this.socket
    }

    // VITE_API_URL ends with /api, but Socket.IO must connect to the server root
    const serverUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      // Evaluated on every (re)connect so the server can tell who is connected
      auth: async (callback) => {
        try {
          await auth.authStateReady()
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
          callback({ token })
        } catch (error) {
          callback({ token: null })
        }
      }
    })

    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server')
      this.connected = true
      // (Re)join rooms requested before the connection was ready or lost on reconnect
      this.rooms.forEach((room) => this.socket.emit('join-room', room))
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO server:', reason)
      this.connected = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error)
      this.connected = false
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected to Socket.IO server (attempt ${attemptNumber})`)
      this.connected = true
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Socket.IO reconnection error:', error)
    })

    return this.socket
  }

  // Reconnect on the same socket (listeners are kept) so the server sees the current login
  reconnect() {
    if (this.socket) {
      this.connected = false
      this.socket.disconnect()
      this.socket.connect()
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      console.log('🔌 Disconnected from Socket.IO server')
    }
  }

  emit(event, data) {
    // Remember rooms so they are joined as soon as the socket is connected
    if (event === 'join-room') {
      this.rooms.add(data)
    } else if (event === 'leave-room') {
      this.rooms.delete(data)
    }

    if (this.socket && this.connected) {
      this.socket.emit(event, data)
    } else if (event !== 'join-room' && event !== 'leave-room') {
      console.warn('⚠️ Socket not connected, cannot emit event:', event)
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback)
    } else {
      console.warn('⚠️ Socket not initialized, cannot listen to event:', event)
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  // Convenience methods for issue-related events
  joinIssuesRoom() {
    this.emit('join-room', 'issues')
  }

  leaveIssuesRoom() {
    this.emit('leave-room', 'issues')
  }

  joinUserRoom(userId) {
    this.emit('join-room', `user-${userId}`)
  }

  leaveUserRoom(userId) {
    this.emit('leave-room', `user-${userId}`)
  }

  // Issue-specific event emitters
  emitIssueCreated(issue) {
    this.emit('issue-created', issue)
  }

  emitIssueUpdated(issue) {
    this.emit('issue-updated', issue)
  }

  emitIssueStatusChanged(issueId, status, updatedBy) {
    this.emit('issue-status-changed', {
      issueId,
      status,
      updatedBy,
      timestamp: new Date().toISOString()
    })
  }

  emitIssueAssigned(issueId, assignedTo, assignedBy) {
    this.emit('issue-assigned', {
      issueId,
      assignedTo,
      assignedBy,
      timestamp: new Date().toISOString()
    })
  }

  // Listen to issue events with callbacks
  onIssueCreated(callback) {
    this.on('issue-created', callback)
  }

  onIssueUpdated(callback) {
    this.on('issue-updated', callback)
  }

  onIssueStatusChanged(callback) {
    this.on('issue-status-changed', callback)
  }

  onIssueAssigned(callback) {
    this.on('issue-assigned', callback)
  }

  // Check connection status
  isConnected() {
    return this.connected && this.socket?.connected
  }

  // Get socket ID
  getSocketId() {
    return this.socket?.id
  }
}

// Create and export a singleton instance
export const socketService = new SocketService()
export default socketService
