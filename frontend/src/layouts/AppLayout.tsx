import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/clients', label: 'Clients' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/opportunites', label: 'Opportunités' },
  { to: '/import', label: 'Import' }
];

export function AppLayout() {
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="text-lg sm:text-xl font-semibold text-indigo-600">CRM Codex</div>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-4 text-sm font-medium">
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium transition ${
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
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full text-left rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Déconnexion
              </button>
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
