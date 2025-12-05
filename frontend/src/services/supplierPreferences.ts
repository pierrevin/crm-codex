// Service pour mémoriser les préférences par fournisseur
interface SupplierPreferences {
  vatRate?: number;
  accountCode?: string;
  accountLabel?: string;
}

const STORAGE_KEY = 'supplier_preferences';

export const supplierPreferencesService = {
  // Récupérer les préférences d'un fournisseur
  get(supplierId: string): SupplierPreferences | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const preferences = JSON.parse(stored);
      return preferences[supplierId] || null;
    } catch (error) {
      console.error('Erreur lecture préférences fournisseur:', error);
      return null;
    }
  },

  // Sauvegarder les préférences d'un fournisseur
  save(supplierId: string, preferences: SupplierPreferences): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allPreferences = stored ? JSON.parse(stored) : {};
      
      allPreferences[supplierId] = {
        ...allPreferences[supplierId],
        ...preferences
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPreferences));
    } catch (error) {
      console.error('Erreur sauvegarde préférences fournisseur:', error);
    }
  },

  // Récupérer les préférences par nom de fournisseur (fallback si pas d'ID)
  getByName(supplierName: string): SupplierPreferences | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const preferences = JSON.parse(stored);
      // Chercher par nom dans les clés (qui peuvent être des IDs ou des noms)
      for (const [key, prefs] of Object.entries(preferences)) {
        // Si la clé contient le nom du fournisseur, retourner les préférences
        if (key.toLowerCase().includes(supplierName.toLowerCase())) {
          return prefs as SupplierPreferences;
        }
      }
      return null;
    } catch (error) {
      console.error('Erreur lecture préférences fournisseur par nom:', error);
      return null;
    }
  },

  // Sauvegarder par nom de fournisseur (fallback si pas d'ID)
  saveByName(supplierName: string, preferences: SupplierPreferences): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allPreferences = stored ? JSON.parse(stored) : {};
      
      // Utiliser le nom comme clé (normalisé en minuscules)
      const key = supplierName.toLowerCase().trim();
      allPreferences[key] = {
        ...allPreferences[key],
        ...preferences
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPreferences));
    } catch (error) {
      console.error('Erreur sauvegarde préférences fournisseur par nom:', error);
    }
  }
};

