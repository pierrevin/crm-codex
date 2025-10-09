import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthGate } from './components/AuthGate';
import { AppLayout } from './layouts/AppLayout';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ContactsListPage } from './pages/ContactsListPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPage } from './pages/ImportPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage';

function App() {
  return (
    <Routes>
      <Route element={<AuthGate />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/contacts" element={<ContactsListPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
          <Route path="/opportunites" element={<OpportunitiesPage />} />
          <Route path="/opportunites/:id" element={<OpportunityDetailPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/clients" element={<CompaniesPage />} />
          <Route path="/clients/:id" element={<CompanyDetailPage />} />
          <Route path="/import" element={<ImportPage />} />
          
          {/* Redirections pour les anciennes URLs */}
          <Route path="/companies" element={<Navigate to="/clients" replace />} />
          <Route path="/companies/:id" element={<Navigate to="/clients/:id" replace />} />
          <Route path="/opportunities" element={<Navigate to="/opportunites" replace />} />
          <Route path="/opportunities/:id" element={<Navigate to="/opportunites/:id" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
