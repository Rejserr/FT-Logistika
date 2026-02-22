import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'
import { ToastContainer } from './components/common'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import RoutingPage from './pages/RoutingPage'
import RoutesHistoryPage from './pages/RoutesHistoryPage'
import RouteDetailPage from './pages/RouteDetailPage'
import OrdersPage from './pages/OrdersPage'
import ArtikliPage from './pages/ArtikliPage'
import GrupeArtikalaPage from './pages/GrupeArtikalaPage'
import VehiclesPage from './pages/VehiclesPage'
import RegionsPage from './pages/RegionsPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import RolesPage from './pages/RolesPage'
import WarehousesPage from './pages/WarehousesPage'
import AuditLogPage from './pages/AuditLogPage'
import PodPage from './pages/PodPage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="routing" element={<RoutingPage />} />
            <Route path="routes" element={<RoutesHistoryPage />} />
            <Route path="routes/:routeId" element={<RouteDetailPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="artikli" element={<ArtikliPage />} />
            <Route path="artikli-grupe" element={<GrupeArtikalaPage />} />
            <Route path="pod" element={<PodPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="regions" element={<RegionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
            <Route path="audit" element={<AuditLogPage />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </AuthProvider>
  )
}

export default App
