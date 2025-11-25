import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentAiService } from './document-ai.service';

@Injectable()
export class ExpenseParserService {
  constructor(
    private prisma: PrismaService,
    private documentAi: DocumentAiService
  ) {}

  async parseExpenseData(ocrData: any): Promise<{
    supplierName?: string;
    invoiceNumber?: string;
    invoiceDate?: Date;
    amountHT?: number;
    amountTTC?: number;
    vatAmount?: number;
    vatRate?: number;
    companyId?: string;
    accountCode?: string;
    accountLabel?: string;
  }> {
    // Extraire les données structurées depuis l'OCR
    const expenseData = this.documentAi.extractExpenseData(ocrData);

    // Rechercher le fournisseur dans la base (optionnel)
    let companyId: string | undefined;
    if (expenseData.supplierName) {
      const company = await this.findSupplierByName(expenseData.supplierName);
      companyId = company?.id;
    }

    // Déterminer le compte comptable (si non fourni)
    const accountCode = this.determineAccountCode(expenseData);

    return {
      ...expenseData,
      companyId,
      accountCode,
      accountLabel: this.getAccountLabel(accountCode)
    };
  }

  private async findSupplierByName(supplierName: string) {
    if (!supplierName) return null;

    // Normaliser le nom du fournisseur (enlever caractères spéciaux, espaces multiples, etc.)
    const normalized = supplierName
      .trim()
      .replace(/\s+/g, ' ') // Espaces multiples -> un seul
      .replace(/[^\w\s-]/g, '') // Enlever caractères spéciaux sauf tirets
      .toLowerCase();

    // Recherche exacte d'abord
    let company = await this.prisma.company.findFirst({
      where: {
        name: { equals: supplierName, mode: 'insensitive' }
      }
    });

    // Si pas trouvé, recherche avec nom normalisé
    if (!company) {
      company = await this.prisma.company.findFirst({
        where: {
          name: { equals: normalized, mode: 'insensitive' }
        }
      });
    }

    // Si pas trouvé, recherche partielle avec plusieurs mots-clés
    if (!company) {
      const words = normalized.split(' ').filter(w => w.length > 2); // Mots de plus de 2 caractères
      
      if (words.length > 0) {
        // Essayer avec tous les mots
        company = await this.prisma.company.findFirst({
          where: {
            OR: words.map(word => ({
              name: { contains: word, mode: 'insensitive' }
            }))
          }
        });

        // Si toujours pas trouvé, essayer avec le premier mot (souvent le nom principal)
        if (!company && words.length > 0) {
          company = await this.prisma.company.findFirst({
            where: {
              name: { contains: words[0], mode: 'insensitive' }
            }
          });
        }

        // Essayer aussi avec les initiales ou acronymes
        if (!company && words.length > 1) {
          const initials = words.map(w => w[0]).join('');
          if (initials.length >= 2) {
            company = await this.prisma.company.findFirst({
              where: {
                OR: [
                  { name: { contains: initials, mode: 'insensitive' } },
                  { name: { startsWith: words[0], mode: 'insensitive' } }
                ]
              }
            });
          }
        }
      }
    }

    return company;
  }

  private determineAccountCode(data: any): string {
    // Logique améliorée pour déterminer le compte comptable selon le type de dépense
    // Adaptée aux entreprises de services
    const supplierName = (data.supplierName || '').toLowerCase();
    const fileName = (data.fileName || '').toLowerCase();
    const invoiceNumber = (data.invoiceNumber || '').toLowerCase();

    // Normaliser les accents et caractères spéciaux
    const normalize = (str: string) => str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const normalizedSupplier = normalize(supplierName);
    const normalizedFile = normalize(fileName);
    const normalizedInvoice = normalize(invoiceNumber);

    // Fonction helper pour vérifier les mots-clés
    const matches = (keywords: string[]) => 
      keywords.some(kw => 
        normalizedSupplier.includes(kw) || 
        normalizedFile.includes(kw) || 
        normalizedInvoice.includes(kw)
      );

    // ===== SERVICES EXTÉRIEURS (62XX) =====
    
    // 6221 - Honoraires (avocats, experts-comptables, consultants)
    const honorairesKeywords = [
      'avocat', 'cabinet juridique', 'juriste', 'expert comptable', 'expert-comptable',
      'cabinets d\'expertise comptable', 'consultant', 'conseil', 'advisory', 'lawyer',
      'notaire', 'huissier', 'expertise', 'audit', 'auditeur'
    ];
    if (matches(honorairesKeywords)) {
      return '6221';
    }

    // 6222 - Frais de recouvrement
    const recouvrementKeywords = ['recouvrement', 'recovery', 'factoring', 'affacturage'];
    if (matches(recouvrementKeywords)) {
      return '6222';
    }

    // 6224 - Publicité, publications, relations publiques
    const pubKeywords = [
      'publicite', 'publicité', 'pub', 'advertising', 'marketing', 'communication',
      'agence pub', 'agence communication', 'google ads', 'facebook ads', 'linkedin ads',
      'seo', 'sem', 'social media', 'reseaux sociaux', 'réseaux sociaux', 'influenceur',
      'influencer', 'relations publiques', 'rp', 'pr'
    ];
    if (matches(pubKeywords)) {
      return '6224';
    }

    // 6225 - Documentation générale
    const docKeywords = ['documentation', 'editeur', 'éditeur', 'livre', 'magazine', 'presse', 'abonnement'];
    if (matches(docKeywords)) {
      return '6225';
    }

    // 6226 - Documentation technique
    const docTechKeywords = ['documentation technique', 'manuel technique', 'formation technique', 'certification'];
    if (matches(docTechKeywords)) {
      return '6226';
    }

    // 6227 - Frais d'inscription et de participation à des manifestations
    const manifestationKeywords = [
      'salon', 'congres', 'congrès', 'conference', 'conférence', 'seminaire', 'séminaire',
      'colloque', 'forum', 'exposition', 'trade show', 'event', 'événement', 'inscription',
      'badge', 'ticket', 'billet'
    ];
    if (matches(manifestationKeywords)) {
      return '6227';
    }

    // 6228 - Formation du personnel
    const formationKeywords = [
      'formation', 'training', 'stage', 'cours', 'ecole', 'école', 'universite', 'université',
      'mooc', 'elearning', 'e-learning', 'certification', 'diplome', 'diplôme'
    ];
    if (matches(formationKeywords)) {
      return '6228';
    }

    // 6231 - Études et recherches
    const etudesKeywords = [
      'etude', 'étude', 'research', 'recherche', 'sondage', 'enquete', 'enquête',
      'analyse', 'audit', 'benchmark', 'veille', 'intelligence'
    ];
    if (matches(etudesKeywords)) {
      return '6231';
    }

    // 6232 - Documentation générale (doublon avec 6225, mais séparé pour précision)
    if (matches(['documentation generale', 'documentation générale'])) {
      return '6232';
    }

    // 6234 - Frais de colloques, congrès, séminaires
    if (matches(['colloque', 'congres', 'congrès', 'seminaire', 'séminaire'])) {
      return '6234';
    }

    // ===== TRANSPORTS (624X) =====
    
    // 6241 - Transports de biens et collecte d'emballages
    const transportBiensKeywords = [
      'transport', 'livraison', 'delivery', 'colis', 'fret', 'logistique', 'dhl', 'ups', 'fedex',
      'chronopost', 'mondial relay', 'relais colis'
    ];
    if (matches(transportBiensKeywords)) {
      return '6241';
    }

    // 6242 - Transports de personnes
    const transportPersonnesKeywords = [
      'taxi', 'uber', 'bolt', 'heetch', 'lyft', 'train', 'sncf', 'ouigo', 'tgv', 'ter',
      'metro', 'métro', 'bus', 'tram', 'velib', 'vélib', 'location voiture', 'location de voiture',
      'avis', 'europcar', 'hertz', 'sixt', 'rent a car'
    ];
    if (matches(transportPersonnesKeywords)) {
      return '6242';
    }

    // 6243 - Transports de déménagement
    if (matches(['demenagement', 'déménagement', 'moving', 'demenageur'])) {
      return '6243';
    }

    // ===== FRAIS DE PERSONNEL (625X) =====
    
    // 6251 - Frais de restauration du personnel
    const restaurationKeywords = [
      'restaurant', 'cafe', 'café', 'bistrot', 'brasserie', 'pizzeria', 'boulangerie',
      'baker', 'mcdonald', 'quick', 'burger', 'kfc', 'subway', 'sandwich', 'traiteur',
      'cantine', 'restauration'
    ];
    if (matches(restaurationKeywords)) {
      return '6251';
    }

    // 6252 - Frais de réception
    const receptionKeywords = [
      'reception', 'réception', 'cocktail', 'buffet', 'vin d\'honneur', 'evenementiel',
      'événementiel', 'catering', 'traiteur'
    ];
    if (matches(receptionKeywords)) {
      return '6252';
    }

    // 6253 - Frais de représentation
    if (matches(['representation', 'représentation', 'client', 'prospect', 'business lunch'])) {
      return '6253';
    }

    // 6254 - Frais de déplacement
    const deplacementKeywords = [
      'deplacement', 'déplacement', 'mission', 'voyage', 'travel', 'kilometrage', 'kilométrage',
      'frais kilometriques', 'frais kilométriques', 'indemnite', 'indemnité'
    ];
    if (matches(deplacementKeywords)) {
      return '6254';
    }

    // 6255 - Frais de logement
    const logementKeywords = [
      'hotel', 'hôtel', 'ibis', 'novotel', 'mercure', 'accor', 'booking', 'airbnb', 'gite', 'gîte',
      'hebergement', 'hébergement', 'lodging', 'accommodation', 'residence', 'résidence'
    ];
    if (matches(logementKeywords)) {
      return '6255';
    }

    // ===== SERVICES BANCAIRES ET ASSIMILÉS (626X) =====
    
    // 6261 - Services bancaires et assimilés
    const bancaireKeywords = [
      'banque', 'bank', 'bancaire', 'credit', 'crédit', 'banque populaire', 'societe generale',
      'société générale', 'bnp', 'lcl', 'credit agricole', 'crédit agricole', 'caisse d\'epargne',
      'caisse d\'épargne', 'frais bancaire', 'agios', 'commission bancaire'
    ];
    if (matches(bancaireKeywords)) {
      return '6261';
    }

    // 6262 - Services d'assurances
    const assuranceKeywords = [
      'assurance', 'insurance', 'maif', 'macif', 'groupama', 'allianz', 'axa', 'generali',
      'matmut', 'gan', 'ama', 'assurance entreprise', 'assurance professionnelle'
    ];
    if (matches(assuranceKeywords)) {
      return '6262';
    }

    // 6263 - Services divers de gestion courante
    const gestionKeywords = [
      'fiduciaire', 'fiducial', 'sage', 'cegid', 'compta', 'comptabilite', 'comptabilité',
      'paie', 'paye', 'rh', 'ressources humaines', 'gestion', 'administration'
    ];
    if (matches(gestionKeywords)) {
      return '6263';
    }

    // 6264 - Frais postaux et de télécommunications
    const telecomKeywords = [
      'orange', 'sfr', 'bouygues', 'free', 'telecom', 'télécom', 'mobile', 'portable',
      'internet', 'fibre', 'adsl', 'box', 'telephonie', 'téléphonie', 'voip', 'skype',
      'poste', 'la poste', 'colissimo', 'chronopost', 'lettre', 'courrier'
    ];
    if (matches(telecomKeywords)) {
      return '6264';
    }

    // 6265 - Services extérieurs des assurances
    if (matches(['expert assurance', 'expertise assurance', 'sinistre'])) {
      return '6265';
    }

    // 6266 - Services extérieurs des banques
    if (matches(['service bancaire externe', 'conseil bancaire'])) {
      return '6266';
    }

    // 6267 - Services extérieurs divers
    const servicesDiversKeywords = [
      'nettoyage', 'cleaning', 'menage', 'ménage', 'entretien', 'maintenance', 'reparation',
      'réparation', 'plomberie', 'electricite', 'électricité', 'chauffage', 'climatisation',
      'gardiennage', 'securite', 'sécurité', 'surveillance'
    ];
    if (matches(servicesDiversKeywords)) {
      return '6267';
    }

    // ===== ACHATS (606X) =====
    
    // 6061 - Carburant
    const carburantKeywords = [
      'station', 'essence', 'total', 'shell', 'esso', 'bp', 'agip', 'aviation', 'carburant',
      'gasoil', 'gas oil', 'diesel', 'sp95', 'sp98', 'e10', 'e85', 'gpl', 'gazole'
    ];
    if (matches(carburantKeywords)) {
      return '6061';
    }

    // 6062 - Fournitures de bureau
    const fournituresKeywords = [
      'bureau', 'papeterie', 'fourniture', 'staples', 'office depot', 'cartridge', 'cartouche',
      'papier', 'stylo', 'crayon', 'enveloppe', 'classeur', 'chemise', 'agrafeuse', 'perforateur'
    ];
    if (matches(fournituresKeywords)) {
      return '6062';
    }

    // 6063 - Services informatiques
    const itKeywords = [
      'microsoft', 'google', 'amazon', 'aws', 'azure', 'cloud', 'hosting', 'hebergement web',
      'hébergement web', 'ovh', 'o2switch', 'gandi', 'namecheap', 'godaddy', 'ionos', '1and1',
      'sas', 'saas', 'software', 'logiciel', 'licence', 'license', 'subscription', 'abonnement',
      'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'slack', 'zoom', 'teams', 'notion',
      'trello', 'asana', 'monday', 'salesforce', 'hubspot', 'zendesk', 'intercom', 'stripe',
      'paypal', 'mangopay', 'adobe', 'autodesk', 'figma', 'sketch', 'invision'
    ];
    if (matches(itKeywords)) {
      return '6063';
    }

    // ===== AUTRES =====
    
    // 6161 - Assurances (charges)
    if (matches(['prime assurance', 'cotisation assurance'])) {
      return '6161';
    }

    // Par défaut : Services extérieurs divers (6267) pour une entreprise de services
    // plutôt que "Achats non stockés" qui est plus adapté au commerce
    return '6267';
  }

  private getAccountLabel(accountCode: string): string {
    const labels: Record<string, string> = {
      // Services extérieurs
      '6221': 'Honoraires',
      '6222': 'Frais de recouvrement',
      '6224': 'Publicité, publications, relations publiques',
      '6225': 'Documentation générale',
      '6226': 'Documentation technique',
      '6227': 'Frais d\'inscription et de participation à des manifestations',
      '6228': 'Formation du personnel',
      '6231': 'Études et recherches',
      '6232': 'Documentation générale',
      '6234': 'Frais de colloques, congrès, séminaires',
      
      // Transports
      '6241': 'Transports de biens et collecte d\'emballages',
      '6242': 'Transports de personnes',
      '6243': 'Transports de déménagement',
      
      // Frais de personnel
      '6251': 'Frais de restauration du personnel',
      '6252': 'Frais de réception',
      '6253': 'Frais de représentation',
      '6254': 'Frais de déplacement',
      '6255': 'Frais de logement',
      
      // Services bancaires et assimilés
      '6261': 'Services bancaires et assimilés',
      '6262': 'Services d\'assurances',
      '6263': 'Services divers de gestion courante',
      '6264': 'Frais postaux et de télécommunications',
      '6265': 'Services extérieurs des assurances',
      '6266': 'Services extérieurs des banques',
      '6267': 'Services extérieurs divers',
      
      // Achats
      '6061': 'Carburant',
      '6062': 'Fournitures de bureau',
      '6063': 'Services informatiques',
      
      // Assurances
      '6161': 'Assurances',
      
      // Par défaut
      '606': 'Achats non stockés'
    };

    return labels[accountCode] || 'Autres charges';
  }
}

