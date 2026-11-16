import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Detail } from './pages/Detail';
import { Favorites } from './pages/Favorites';
import { HistoryPage } from './pages/History';
import { Home } from './pages/Home';
import { MapPage } from './pages/MapPage';
import { NotFound } from './pages/NotFound';
import { Places } from './pages/Places';
import { AdminLayout } from './admin/AdminLayout';
import { Accounts } from './admin/Accounts';
import { Dashboard } from './admin/Dashboard';
import { Languages } from './admin/Languages';
import { LocationEdit } from './admin/LocationEdit';
import { Locations } from './admin/Locations';
import { Login } from './admin/Login';
import { Stats } from './admin/Stats';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="places" element={<Places />} />
        <Route path="l/:code" element={<Detail />} />
        <Route path="map" element={<MapPage />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="admin/login" element={<Login />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="locations" element={<Locations />} />
        <Route path="locations/:id" element={<LocationEdit />} />
        <Route path="languages" element={<Languages />} />
        <Route path="stats" element={<Stats />} />
        <Route path="accounts" element={<Accounts />} />
      </Route>
    </Routes>
  );
}
