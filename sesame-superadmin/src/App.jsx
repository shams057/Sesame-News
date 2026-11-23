import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { SocketProvider } from './lib/socket';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import { EmptyState, Skeleton } from './components/ui';

// One chunk per page: the login screen loads without the rest of the app.
const NewsPage = lazy(() => import('./pages/NewsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const AdminsPage = lazy(() => import('./pages/AdminsPage'));
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const TicketDetailPage = lazy(() => import('./pages/TicketDetailPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const CannedRepliesPage = lazy(() => import('./pages/CannedRepliesPage'));

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'checking') return <div className="login-page" aria-busy="true"><span className="spinner" style={{ color: '#fff' }} /></div>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return <SocketProvider><Suspense fallback={<Skeleton rows={4} />}>{children}</Suspense></SocketProvider>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="canned-replies" element={<CannedRepliesPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="admins" element={<AdminsPage />} />
        <Route path="*" element={<EmptyState icon="search" title="Page introuvable" description="Cette adresse ne correspond à aucune page." />} />
      </Route>
    </Routes>
  );
}
