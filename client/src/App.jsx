import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { CustomerPage } from './components/pages/CustomerDashboard'
import { BasicUserPage } from './components/pages/BasicUserDashboard'
import { SupervisorPage } from './components/pages/SupervisorDashboard'
import { CustomerSignupPage } from './components/pages/CustomerSignup'
import { CustomerLoginPage } from './components/pages/CustomerLogin'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signup" replace />} />
      <Route path="/customer" element={<CustomerPage />} />
      <Route path="/basic-user" element={<BasicUserPage />} />
      <Route path="/supervisor" element={<SupervisorPage />} />
      <Route path="/signup" element={<CustomerSignupPage />} />
      <Route path="/login" element={<CustomerLoginPage />} />
    </Routes>
  )
}

export default App
