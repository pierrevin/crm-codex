import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/contacts', label: 'Contacts' },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/activities', label: 'Activities' },
  { to: '/import', label: 'Import CSV' }
];

export function AppLayout() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-xl font-semibold text-indigo-600">CRM Codex</div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={logout}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
