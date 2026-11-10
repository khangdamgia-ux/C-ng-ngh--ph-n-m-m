import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Detail } from './pages/Detail';
import { Favorites } from './pages/Favorites';
import { HistoryPage } from './pages/History';
import { Home } from './pages/Home';
import { MapPage } from './pages/MapPage';
import { NotFound } from './pages/NotFound';
import { Places } from './pages/Places';

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
    </Routes>
  );
}
