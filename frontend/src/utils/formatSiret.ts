/**
 * Formate un SIRET pour l'affichage : 784 263 311 00044
 * Format : XXX XXX XXX XXXXX (3-3-3-5)
 */
export function formatSiret(siret: string | null | undefined): string {
  if (!siret) return '';
  
  // Supprimer tous les espaces et caractères non numériques
  const cleaned = siret.replace(/\s+/g, '').replace(/\D/g, '');
  
  // Un SIRET doit faire 14 chiffres
  if (cleaned.length !== 14) return siret; // Retourner tel quel si format invalide
  
  // Formater : XXX XXX XXX XXXXX
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 14)}`;
}

/**
 * Normalise un SIRET en supprimant tous les espaces et caractères non numériques
 */
export function normalizeSiret(siret: string): string {
  return siret.replace(/\s+/g, '').replace(/\D/g, '');
}

