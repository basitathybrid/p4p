import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { CustomerPage } from './components/pages/CustomerDashboard'
import { BasicUserPage } from './components/pages/BasicUserDashboard'
import { SupervisorPage } from './components/pages/SupervisorDashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/customer" replace />} />
      <Route path="/customer" element={<CustomerPage />} />
      <Route path="/basic-user" element={<BasicUserPage />} />
      <Route path="/supervisor" element={<SupervisorPage />} />
    </Routes>
  )
}

export default App
