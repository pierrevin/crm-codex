import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthGate } from './components/AuthGate';
import { AppLayout } from './layouts/AppLayout';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ContactsListPage } from './pages/ContactsListPage';
import { DashboardPage } from './pages/DashboardPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { GoogleLoginCallbackPage } from './pages/GoogleLoginCallbackPage';
import { ImportPage } from './pages/ImportPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage';
import { QuoteDetailPage } from './pages/QuoteDetailPage';
import { WebhooksPage } from './pages/WebhooksPage';

function App() {
  return (
    <Routes>
      {/* Routes publiques (pas besoin d'authentification) */}
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      <Route path="/auth/google/login" element={<GoogleLoginCallbackPage />} />
      
      {/* Routes protégées (nécessitent une authentification) */}
      <Route element={<AuthGate />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/contacts" element={<ContactsListPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
          <Route path="/opportunites" element={<OpportunitiesPage />} />
          <Route path="/opportunites/:id" element={<OpportunityDetailPage />} />
          <Route path="/quotes/:id" element={<QuoteDetailPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/entreprises" element={<CompaniesPage />} />
          <Route path="/entreprises/:id" element={<CompanyDetailPage />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          
          {/* Redirections pour les anciennes URLs */}
          <Route path="/companies" element={<Navigate to="/entreprises" replace />} />
          <Route path="/companies/:id" element={<Navigate to="/entreprises/:id" replace />} />
          <Route path="/clients" element={<Navigate to="/entreprises" replace />} />
          <Route path="/clients/:id" element={<Navigate to="/entreprises/:id" replace />} />
          <Route path="/opportunities" element={<Navigate to="/opportunites" replace />} />
          <Route path="/opportunities/:id" element={<Navigate to="/opportunites/:id" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
