import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import MapPage from '@/pages/MapPage';
import UploadPage from '@/pages/UploadPage';
import LoginPage from '@/pages/LoginPage';
import AdminLayout from '@/pages/AdminLayout';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import AdminLicensesPage from '@/pages/AdminLicensesPage';
import AdminLogsPage from '@/pages/AdminLogsPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import ForbiddenPage from '@/pages/ForbiddenPage';
import EnterpriseDetailsPage from '@/pages/EnterpriseDetailsPage';
import FkkoDirectoryPage from '@/pages/FkkoDirectoryPage';
import UserDashboardPage from '@/pages/UserDashboardPage';
import UserUploadPage from '@/pages/UserUploadPage';
import UserProfilePage from '@/pages/UserProfilePage';
import SupportChatPage from '@/pages/SupportChatPage';
import PersonalDataConsentPage from '@/pages/PersonalDataConsentPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import CookiePolicyPage from '@/pages/CookiePolicyPage';
import { AuthProvider } from '@/contexts/AuthContext';
import { RequireRole } from '@/components/auth/RequireRole';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { trackMetrikaPage } from '@/lib/metrika';
import { useEffect } from 'react';

function MetrikaPageTracker(): null {
  const location = useLocation();

  useEffect(() => {
    const url = `${location.pathname}${location.search}${location.hash}`;
    trackMetrikaPage(url);
  }, [location.pathname, location.search, location.hash]);

  return null;
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MetrikaPageTracker />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/directory" element={<FkkoDirectoryPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/enterprise/:id" element={<EnterpriseDetailsPage />} />
          <Route path="/consent/personal-data" element={<PersonalDataConsentPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
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
            <Route path="support" element={<SupportChatPage />} />
            <Route path="licenses/:id" element={<EnterpriseDetailsPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route
            path="/admin"
            element={
              <RequireRole minRole="MODERATOR">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="licenses" element={<AdminLicensesPage />} />
            <Route path="licenses/:id" element={<EnterpriseDetailsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="support" element={<SupportChatPage />} />
            <Route
              path="users"
              element={
                <RequireRole minRole="SUPERADMIN">
                  <AdminUsersPage />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
        <CookieConsentBanner />
      </BrowserRouter>
    </AuthProvider>
  );
}
