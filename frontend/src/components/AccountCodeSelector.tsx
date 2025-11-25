import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface AccountCode {
  code: string;
  label: string;
}

// Liste complète des comptes comptables pour entreprises de services
const ACCOUNT_CODES: AccountCode[] = [
  // Services extérieurs
  { code: '6221', label: 'Honoraires' },
  { code: '6222', label: 'Frais de recouvrement' },
  { code: '6224', label: 'Publicité, publications, relations publiques' },
  { code: '6225', label: 'Documentation générale' },
  { code: '6226', label: 'Documentation technique' },
  { code: '6227', label: 'Frais d\'inscription et de participation à des manifestations' },
  { code: '6228', label: 'Formation du personnel' },
  { code: '6231', label: 'Études et recherches' },
  { code: '6232', label: 'Documentation générale' },
  { code: '6234', label: 'Frais de colloques, congrès, séminaires' },
  
  // Transports
  { code: '6241', label: 'Transports de biens et collecte d\'emballages' },
  { code: '6242', label: 'Transports de personnes' },
  { code: '6243', label: 'Transports de déménagement' },
  
  // Frais de personnel
  { code: '6251', label: 'Frais de restauration du personnel' },
  { code: '6252', label: 'Frais de réception' },
  { code: '6253', label: 'Frais de représentation' },
  { code: '6254', label: 'Frais de déplacement' },
  { code: '6255', label: 'Frais de logement' },
  
  // Services bancaires et assimilés
  { code: '6261', label: 'Services bancaires et assimilés' },
  { code: '6262', label: 'Services d\'assurances' },
  { code: '6263', label: 'Services divers de gestion courante' },
  { code: '6264', label: 'Frais postaux et de télécommunications' },
  { code: '6265', label: 'Services extérieurs des assurances' },
  { code: '6266', label: 'Services extérieurs des banques' },
  { code: '6267', label: 'Services extérieurs divers' },
  
  // Achats
  { code: '6061', label: 'Carburant' },
  { code: '6062', label: 'Fournitures de bureau' },
  { code: '6063', label: 'Services informatiques' },
  
  // Assurances
  { code: '6161', label: 'Assurances' },
  
  // Par défaut
  { code: '606', label: 'Achats non stockés' }
];

interface AccountCodeSelectorProps {
  value: string;
  onChange: (code: string, label: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

export function AccountCodeSelector({
  value,
  onChange,
  label = 'Code compte',
  required = false,
  className = ''
}: AccountCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAccounts, setFilteredAccounts] = useState<AccountCode[]>(ACCOUNT_CODES);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrer les comptes selon le terme de recherche
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAccounts(ACCOUNT_CODES);
    } else {
      const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const filtered = ACCOUNT_CODES.filter(account =>
        account.code.toLowerCase().includes(term) ||
        account.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term)
      );
      setFilteredAccounts(filtered);
    }
  }, [searchTerm]);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus sur l'input de recherche quand le dropdown s'ouvre
      setTimeout(() => inputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedAccount = ACCOUNT_CODES.find(acc => acc.code === value);

  const handleSelect = (account: AccountCode) => {
    onChange(account.code, account.label);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          !selectedAccount ? 'text-slate-400' : 'text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {selectedAccount ? (
              <div>
                <span className="font-medium">{selectedAccount.code}</span>
                <span className="ml-2 text-slate-600 text-sm truncate">
                  {selectedAccount.label}
                </span>
              </div>
            ) : (
              <span>Sélectionner un compte...</span>
            )}
          </div>
          <ChevronDownIcon
            className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Barre de recherche */}
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par code ou libellé..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Liste des comptes */}
          <div className="overflow-y-auto max-h-64">
            {filteredAccounts.length > 0 ? (
              <ul className="py-1">
                {filteredAccounts.map((account) => (
                  <li key={account.code}>
                    <button
                      type="button"
                      onClick={() => handleSelect(account)}
                      className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                        value === account.code ? 'bg-blue-100' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-900">{account.code}</span>
                          <span className="ml-2 text-sm text-slate-600">{account.label}</span>
                        </div>
                        {value === account.code && (
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Aucun compte trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

