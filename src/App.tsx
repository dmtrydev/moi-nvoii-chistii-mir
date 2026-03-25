import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import MapPage from '@/pages/MapPage';
import UploadPage from '@/pages/UploadPage';
import LoginPage from '@/pages/LoginPage';
import AdminLayout from '@/pages/AdminLayout';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import AdminLicensesPage from '@/pages/AdminLicensesPage';
import AdminLogsPage from '@/pages/AdminLogsPage';
import ForbiddenPage from '@/pages/ForbiddenPage';
import EnterpriseDetailsPage from '@/pages/EnterpriseDetailsPage';
import FkkoDirectoryPage from '@/pages/FkkoDirectoryPage';
import UserDashboardPage from '@/pages/UserDashboardPage';
import UserUploadPage from '@/pages/UserUploadPage';
import UserProfilePage from '@/pages/UserProfilePage';
import { AuthProvider } from '@/contexts/AuthContext';
import { RequireRole } from '@/components/auth/RequireRole';

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/directory" element={<FkkoDirectoryPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/enterprise/:id" element={<EnterpriseDetailsPage />} />
          <Route
            path="/upload"
            element={
              <RequireRole minRole="USER">
                <UploadPage />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireRole minRole="USER">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<UserDashboardPage />} />
            <Route path="profile" element={<UserProfilePage />} />
            <Route path="upload" element={<UserUploadPage />} />
            <Route path="licenses/:id" element={<EnterpriseDetailsPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route
            path="/admin"
            element={
              <RequireRole minRole="SUPERADMIN">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="licenses" element={<AdminLicensesPage />} />
            <Route path="licenses/:id" element={<EnterpriseDetailsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
