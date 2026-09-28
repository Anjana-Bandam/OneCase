import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CaseStoreProvider } from './state/CaseStore'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Login from './pages/Login'
import GetSupport from './pages/GetSupport'
import Recommend from './pages/Recommend'
import MyCase from './pages/MyCase'
import StaffDashboard from './pages/StaffDashboard'
import MyTasks from './pages/MyTasks'
import CaseView from './pages/CaseView'
import Coordinator from './pages/Coordinator'
import AcademicRecords from './pages/AcademicRecords'
import './styles.css'

const STUDENT = ['student']
const STAFF = ['staff', 'coordinator']
const ANY = ['student', 'staff', 'coordinator']
const guard = (roles, el) => <RequireAuth roles={roles}>{el}</RequireAuth>

createRoot(document.getElementById('root')).render(
  <CaseStoreProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="support" element={guard(STUDENT, <GetSupport />)} />
          <Route path="support/review" element={guard(STUDENT, <Recommend />)} />
          <Route path="my-case" element={guard(STUDENT, <MyCase />)} />
          <Route path="my-case/:id" element={guard(ANY, <MyCase />)} />
          <Route path="staff" element={guard(STAFF, <StaffDashboard />)} />
          <Route path="staff/tasks" element={guard(STAFF, <MyTasks />)} />
          <Route path="staff/case/:id" element={guard(STAFF, <CaseView />)} />
          <Route path="staff/academic" element={guard(STAFF, <AcademicRecords />)} />
          <Route path="coordinator" element={guard(['coordinator'], <Coordinator />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </CaseStoreProvider>
)
