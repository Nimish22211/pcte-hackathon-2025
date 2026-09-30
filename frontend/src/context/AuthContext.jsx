import { createContext, useContext, useReducer, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { apiService } from '../services/apiService'
import toast from 'react-hot-toast'

const AuthContext = createContext()

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true
}

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false
      }
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false
      }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      }
    default:
      return state
  }
}

const getRedirectPath = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard'
    case 'official':
      return '/official/dashboard'
    case 'serviceman':
      return '/serviceman/dashboard'
    default:
      return '/dashboard' // citizen
  }
}

const getLoginErrorMessage = (error) => {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid credentials'
    case 'auth/user-disabled':
      return 'This account has been deactivated'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.'
    default:
      if (error.response?.status === 401) return 'This account has been deactivated'
      return error.response?.data?.error || 'Login failed'
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Keep the app in sync with the Firebase Auth session (restores login on page load)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        dispatch({ type: 'LOGIN_FAILURE' })
        return
      }

      try {
        const response = await apiService.get('/auth/me')
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.data.user } })
      } catch (error) {
        // Signed in to Firebase but no active profile (e.g. deactivated account)
        if (error.response?.status === 401) {
          await signOut(auth)
        }
        dispatch({ type: 'LOGIN_FAILURE' })
      }
    })

    return unsubscribe
  }, [])

  const login = async (email, password) => {
    try {
      dispatch({ type: 'LOGIN_START' })
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)

      const response = await apiService.get('/auth/me')
      const { user } = response.data

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user } })

      toast.success('Login successful!')
      return { success: true, redirectPath: getRedirectPath(user.role) }
    } catch (error) {
      await signOut(auth)
      dispatch({ type: 'LOGIN_FAILURE' })
      const message = getLoginErrorMessage(error)
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const register = async (userData) => {
    try {
      dispatch({ type: 'LOGIN_START' })
      // The backend validates the data and creates the Firebase Auth account + profile
      await apiService.post('/auth/register', userData)

      // Then sign in with the new credentials
      await signInWithEmailAndPassword(auth, userData.email.trim().toLowerCase(), userData.password)

      const response = await apiService.get('/auth/me')
      const { user } = response.data

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user } })

      toast.success('Registration successful!')
      return { success: true, redirectPath: getRedirectPath(user.role) }
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE' })
      const message = error.response?.data?.details?.[0]?.msg
        || error.response?.data?.error
        || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    await signOut(auth)
    dispatch({ type: 'LOGOUT' })
    toast.success('Logged out successfully')
  }

  const updateUser = (userData) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: userData
    })
  }

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
