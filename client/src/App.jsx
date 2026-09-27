import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import config from './config'
import { CustomerPage } from './components/pages/CustomerDashboard'
import { BasicUserPage } from './components/pages/BasicUserDashboard'
import { SupervisorPage } from './components/pages/SupervisorDashboard'
import { CustomerSignupPage } from './components/pages/CustomerSignup'
import { CustomerLoginPage } from './components/pages/CustomerLogin'
import { SupervisorLoginPage } from './components/pages/SupervisorLogin'
import { BasicUserLoginPage } from './components/pages/BasicUserLogin'

function ProtectedRoute({ children, allowedRole }) {
  const role = localStorage.getItem('p4p_user_role')
  const tokenKey = allowedRole === 'supervisor'
    ? 'p4p_supervisor_token'
    : allowedRole === 'basic'
      ? 'p4p_basic_token'
      : 'p4p_customer_token'
  const token = localStorage.getItem(tokenKey)
  const [authStatus, setAuthStatus] = useState(token && role === allowedRole ? 'checking' : 'invalid')
  const loginPath = allowedRole === 'supervisor' ? '/supervisorlogin' : allowedRole === 'basic' ? '/basicuserlogin' : '/login'

  useEffect(() => {
    if (!token || role !== allowedRole) {
      setAuthStatus('invalid')
      return undefined
    }

    const controller = new AbortController()
    fetch(config.REST_API.Auth.Session, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok || data?.role !== allowedRole) throw new Error('Invalid dashboard session.')
        setAuthStatus('valid')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        localStorage.removeItem(tokenKey)
        if (localStorage.getItem('p4p_user_role') === allowedRole) {
          localStorage.removeItem('p4p_user_role')
        }
        setAuthStatus('invalid')
      })

    return () => controller.abort()
  }, [allowedRole, role, token, tokenKey])

  if (authStatus === 'invalid') return <Navigate to={loginPath} replace />
  if (authStatus !== 'valid') return <div role="status">Checking your session...</div>

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signup" replace />} />
      <Route path="/customer" element={<ProtectedRoute allowedRole="customer"><CustomerPage /></ProtectedRoute>} />
      <Route path="/basic-user" element={<ProtectedRoute allowedRole="basic"><BasicUserPage /></ProtectedRoute>} />
      <Route path="/supervisor" element={<ProtectedRoute allowedRole="supervisor"><SupervisorPage /></ProtectedRoute>} />
      <Route path="/signup" element={<CustomerSignupPage />} />
      <Route path="/login" element={<CustomerLoginPage />} />
      <Route path="/supervisorlogin" element={<SupervisorLoginPage />} />
      <Route path="/basicuserlogin" element={<BasicUserLoginPage />} />
    </Routes>
  )
}

export default App
