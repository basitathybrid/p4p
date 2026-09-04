import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { CustomerPage } from './components/pages/CustomerDashboard'
import { BasicUserPage } from './components/pages/BasicUserDashboard'
import { SupervisorPage } from './components/pages/SupervisorDashboard'
import { CustomerSignupPage } from './components/pages/CustomerSignup'
import { CustomerLoginPage } from './components/pages/CustomerLogin'
import { SupervisorLoginPage } from './components/pages/SupervisorLogin'

function ProtectedRoute({ children, allowedRole }) {
  const role = localStorage.getItem('p4p_user_role')
  const token = allowedRole === 'supervisor'
    ? localStorage.getItem('p4p_supervisor_token')
    : localStorage.getItem('p4p_customer_token')

  if (!token || role !== allowedRole) {
    return <Navigate to={allowedRole === 'supervisor' ? '/supervisorlogin' : '/login'} replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signup" replace />} />
      <Route path="/customer" element={<ProtectedRoute allowedRole="customer"><CustomerPage /></ProtectedRoute>} />
      <Route path="/basic-user" element={<ProtectedRoute allowedRole="customer"><BasicUserPage /></ProtectedRoute>} />
      <Route path="/supervisor" element={<ProtectedRoute allowedRole="supervisor"><SupervisorPage /></ProtectedRoute>} />
      <Route path="/signup" element={<CustomerSignupPage />} />
      <Route path="/login" element={<CustomerLoginPage />} />
      <Route path="/supervisorlogin" element={<SupervisorLoginPage />} />
    </Routes>
  )
}

export default App
