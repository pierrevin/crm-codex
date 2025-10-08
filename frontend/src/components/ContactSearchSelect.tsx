import { useEffect, useState } from 'react';

export function ContactSearchSelect({
  contacts,
  selectedContactId,
  onSelectContact,
  onCreateContact,
  defaultCompanyId,
  defaultCompanyName
}: {
  contacts: any[];
  selectedContactId?: string;
  onSelectContact: (contactId?: string) => void;
  onCreateContact: (firstName: string, lastName: string, companyId?: string) => Promise<void>;
  defaultCompanyId?: string;
  defaultCompanyName?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.contact-search-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredContacts = contacts.filter(contact => {
    const fullName = `${contact.firstName} ${contact.lastName || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || 
           contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const exactMatch = filteredContacts.find(c => {
    const fullName = `${c.firstName} ${c.lastName || ''}`.toLowerCase();
    return fullName === searchTerm.toLowerCase();
  });

  const handleCreateNew = async () => {
    if (!searchTerm.trim()) return;
    setIsCreating(true);
    try {
      const parts = searchTerm.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      await onCreateContact(firstName, lastName, defaultCompanyId);
      setSearchTerm('');
      setShowDropdown(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectContact = (contact: any) => {
    onSelectContact(contact.id);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelectContact(undefined);
    setSearchTerm('');
  };

  const getContactDisplay = (contact: any) => {
    return `${contact.firstName} ${contact.lastName || ''}`.trim();
  };

  return (
    <div className="relative contact-search-container">
      <div className="relative">
        <input
          type="text"
          value={selectedContact ? getContactDisplay(selectedContact) : searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
            if (selectedContact) {
              onSelectContact(undefined);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Rechercher ou créer un contact..."
          className="w-full rounded-md border border-slate-200 px-3 py-2 pr-20 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {selectedContact && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && !selectedContact && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-60 overflow-auto">
          {filteredContacts.length > 0 ? (
            <div>
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSelectContact(contact)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">👤</span>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {getContactDisplay(contact)}
                      </div>
                      {contact.email && (
                        <div className="text-xs text-slate-500">{contact.email}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {searchTerm && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={isCreating}
              className="w-full px-3 py-2 text-left text-sm border-t border-slate-100 hover:bg-indigo-50 text-indigo-600 font-medium"
            >
              <div className="flex items-center gap-2">
                <span>✨</span>
                {isCreating ? (
                  <span>Création...</span>
                ) : (
                  <>
                    <span>Créer le contact</span>
                    <span className="font-semibold">"{searchTerm}"</span>
                  </>
                )}
              </div>
              {defaultCompanyId && defaultCompanyName && (
                <div className="text-xs text-slate-500 mt-1 ml-6">
                  → Sera associé à 🏢 {defaultCompanyName}
                </div>
              )}
            </button>
          )}

          {!searchTerm && filteredContacts.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">
              Tapez pour rechercher ou créer un contact
            </div>
          )}
        </div>
      )}
    </div>
  );
}

