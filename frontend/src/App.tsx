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
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/:id" element={<CompanyDetailPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
