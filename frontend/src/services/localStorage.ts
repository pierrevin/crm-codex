// Service pour gérer les éléments récemment consultés dans localStorage

const RECENT_COMPANIES_KEY = 'recent_companies';
const RECENT_CONTACTS_KEY = 'recent_contacts';
const MAX_RECENT_ITEMS = 3;

export interface RecentItem {
  id: string;
  name: string;
  timestamp: number;
}

export const recentStorage = {
  // Companies
  addCompany(id: string, name: string) {
    const recent = this.getCompanies();
    // Retirer si déjà présent
    const filtered = recent.filter(item => item.id !== id);
    // Ajouter au début
    const updated = [{ id, name, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(RECENT_COMPANIES_KEY, JSON.stringify(updated));
  },

  getCompanies(): RecentItem[] {
    try {
      const data = localStorage.getItem(RECENT_COMPANIES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Contacts
  addContact(id: string, name: string) {
    const recent = this.getContacts();
    // Retirer si déjà présent
    const filtered = recent.filter(item => item.id !== id);
    // Ajouter au début
    const updated = [{ id, name, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(RECENT_CONTACTS_KEY, JSON.stringify(updated));
  },

  getContacts(): RecentItem[] {
    try {
      const data = localStorage.getItem(RECENT_CONTACTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Clear
  clearCompanies() {
    localStorage.removeItem(RECENT_COMPANIES_KEY);
  },

  clearContacts() {
    localStorage.removeItem(RECENT_CONTACTS_KEY);
  }
};

