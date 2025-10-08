import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthGate } from './components/AuthGate';
import { AppLayout } from './layouts/AppLayout';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ContactsListPage } from './pages/ContactsListPage';
import { ImportPage } from './pages/ImportPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';

function App() {
  return (
    <Routes>
      <Route element={<AuthGate />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/contacts" replace />} />
          <Route path="/contacts" element={<ContactsListPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
