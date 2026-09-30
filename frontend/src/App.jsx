import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { IssueProvider } from './context/IssueContext'
import { NotificationProvider } from './context/NotificationContext'
import { Toaster } from 'react-hot-toast'

// Pages
import HomePage from './pages/HomePage'
import ReportIssuePage from './pages/ReportIssuePage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Landing from './pages/Landing'
import IssueDetailsPage from './pages/IssueDetailsPage'
import AdminDashboard from './pages/AdminDashboard'
import OfficialDashboard from './pages/OfficialDashboard'
import ServiceManDashboard from './pages/ServiceManDashboard'

// Components
import {Header} from './components/LandingPageComponents/Header'
import ProtectedRoute from './components/Common/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <IssueProvider>
          <Router>
            <div className="min-h-screen bg-background">
              <Header />
              <main className='mt-16'>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/map" element={<HomePage />} />
                <Route
                  path="/report"
                  element={
                    <ProtectedRoute>
                      <ReportIssuePage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/issue/:id" element={<IssueDetailsPage />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/dashboard" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/official/dashboard" 
                  element={
                    <ProtectedRoute requiredRole="official">
                      <OfficialDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/serviceman/dashboard" 
                  element={
                    <ProtectedRoute requiredRole="serviceman">
                      <ServiceManDashboard />
                    </ProtectedRoute>
                  }
                />
              </Routes>
              </main>
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                }}
              />
            </div>
          </Router>
        </IssueProvider>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
