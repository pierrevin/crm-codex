import { Injectable } from '@nestjs/common';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class DocumentAiService {
  private client: DocumentProcessorServiceClient;
  private processorName: string;

  constructor(private config: ConfigService) {
    // ID du processeur (à créer dans Google Cloud Console)
    const appConfig = this.config.get<AppConfig>('app')!;
    this.processorName = appConfig.googleDocumentAi.processorId;
    
    // Extraire la région du processeur ID (ex: eu, us, etc.)
    const regionMatch = this.processorName.match(/locations\/([^\/]+)/);
    const region = regionMatch ? regionMatch[1] : 'us';
    
    // Initialiser le client Document AI avec la bonne région
    // Pour la région EU, utiliser l'endpoint européen
    const apiEndpoint = region === 'eu' 
      ? 'eu-documentai.googleapis.com'
      : 'documentai.googleapis.com';
    
    // Options de configuration du client
    const clientOptions: any = {
      apiEndpoint: apiEndpoint,
    };
    
    // Si GOOGLE_APPLICATION_CREDENTIALS est défini, le client l'utilisera automatiquement
    this.client = new DocumentProcessorServiceClient(clientOptions);
    
    console.log(`Document AI client initialisé pour la région: ${region}, endpoint: ${apiEndpoint}, processor: ${this.processorName}`);
  }

  async processDocument(fileBuffer: Buffer, mimeType: string) {
    if (!this.processorName) {
      throw new Error('GOOGLE_DOCUMENT_AI_PROCESSOR_ID not configured');
    }

    // Normaliser le mimeType
    let normalizedMimeType = mimeType;
    if (mimeType === 'application/pdf') {
      normalizedMimeType = 'application/pdf';
    } else if (mimeType.startsWith('image/')) {
      // Document AI accepte: image/jpeg, image/png, image/tiff, image/bmp, image/webp
      if (mimeType === 'image/jpg') {
        normalizedMimeType = 'image/jpeg';
      } else if (!['image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp'].includes(mimeType)) {
        normalizedMimeType = 'image/jpeg'; // Par défaut
      }
    } else {
      // Si le type n'est pas supporté, essayer avec application/pdf
      normalizedMimeType = 'application/pdf';
    }

    // Vérifier que le buffer n'est pas vide
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Le fichier est vide');
    }

    // Vérifier que le processeur name est au bon format
    if (!this.processorName.startsWith('projects/')) {
      throw new Error(`Format de processeur invalide: ${this.processorName}. Format attendu: projects/.../locations/.../processors/...`);
    }

    // Le contenu peut être un Buffer ou une string base64
    // Essayons avec le Buffer directement (l'API devrait le gérer)
    // L'API Document AI accepte un Buffer directement
    const rawDocument = {
      content: fileBuffer,
      mimeType: normalizedMimeType,
    };

    // Le format de la requête pour processDocument
    // Le nom du processeur doit être au format: projects/.../locations/.../processors/...
    const request: any = {
      name: this.processorName,
      rawDocument: rawDocument,
      // Pour Invoice Parser, on peut aussi spécifier skipHumanReview si nécessaire
      skipHumanReview: true,
    };

    try {
      console.log('Appel Document AI:', {
        processor: this.processorName,
        mimeType: normalizedMimeType,
        bufferSize: fileBuffer.length
      });
      
      const [result] = await this.client.processDocument(request);
      
      if (!result.document) {
        throw new Error('Document AI n\'a pas retourné de document');
      }
      
      return result.document;
    } catch (error: any) {
      if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
        throw new Error(
          'Permission refusée pour Document AI. Vérifiez que le compte de service a le rôle "Document AI API User" dans Google Cloud Console.'
        );
      }
      if (error.code === 3 || error.message?.includes('INVALID_ARGUMENT')) {
        console.error('Document AI INVALID_ARGUMENT:', {
          processorName: this.processorName,
          mimeType: normalizedMimeType,
          bufferSize: fileBuffer.length,
          error: error.message
        });
        throw new Error(
          `Argument invalide pour Document AI. Vérifiez le format du fichier (${mimeType}). Formats supportés: PDF, JPG, PNG.`
        );
      }
      throw error;
    }
  }

  extractExpenseData(document: any) {
    // Parser les entités extraites par Document AI
    // Document AI Invoice Parser retourne les données dans document.entities
    const entities = document.entities || [];
    
    const data: any = {};
    
    // Log pour debug
    console.log('Document AI - Nombre d\'entités:', entities.length);
    if (entities.length > 0) {
      console.log('Document AI - Types d\'entités:', entities.map((e: any) => e.type).join(', '));
    }
    
    entities.forEach((entity: any) => {
      const type = entity.type;
      // Document AI peut retourner les valeurs de différentes façons
      let value = entity.mentionText || entity.textAnchor?.textSegments?.[0]?.text;
      
      // Pour les valeurs normalisées (montants, dates)
      if (entity.normalizedValue) {
        if (entity.normalizedValue.moneyValue) {
          // Montant monétaire
          const money = entity.normalizedValue.moneyValue;
          value = money.nanos 
            ? parseFloat(`${money.units || 0}.${money.nanos.toString().padStart(9, '0')}`)
            : (money.units || 0);
        } else if (entity.normalizedValue.dateValue) {
          // Date normalisée
          const date = entity.normalizedValue.dateValue;
          value = new Date(date.year, (date.month || 1) - 1, date.day || 1);
        } else if (entity.normalizedValue.textValue) {
          value = entity.normalizedValue.textValue;
        }
      }
      
      // Mapping des types Document AI Invoice Parser
      switch (type) {
        // Fournisseur
        case 'supplier_name':
        case 'vendor_name':
        case 'merchant_name':
        case 'supplier':
        case 'vendor':
        case 'merchant':
          if (!data.supplierName) data.supplierName = value;
          break;
        // Numéro de facture
        case 'invoice_number':
        case 'invoice_id':
        case 'receipt_id':
        case 'invoice_id_number':
        case 'receipt_number':
          if (!data.invoiceNumber) data.invoiceNumber = value;
          break;
        // Date
        case 'invoice_date':
        case 'receipt_date':
        case 'purchase_date':
        case 'invoice_date_invoice_date':
        case 'receipt_date_receipt_date':
          if (!data.invoiceDate) data.invoiceDate = this.parseDate(value);
          break;
        // Montant HT
        case 'net_amount':
        case 'amount_ht':
        case 'subtotal':
        case 'line_item_amount':
        case 'net_amount_net_amount':
          if (!data.amountHT) data.amountHT = this.parseAmount(value);
          break;
        // Montant TTC
        case 'total_amount':
        case 'amount_ttc':
        case 'total':
        case 'invoice_total':
        case 'total_amount_total_amount':
          if (!data.amountTTC) data.amountTTC = this.parseAmount(value);
          break;
        // Montant TVA
        case 'tax_amount':
        case 'vat_amount':
        case 'tax':
        case 'total_tax_amount':
        case 'tax_amount_tax_amount':
          if (!data.vatAmount) data.vatAmount = this.parseAmount(value);
          break;
        // Taux TVA
        case 'tax_rate':
        case 'vat_rate':
        case 'tax_rate_tax_rate':
          if (!data.vatRate) data.vatRate = this.parseRate(value);
          break;
      }
    });

    // Si TVA non trouvée, calculer depuis HT et TTC
    if (data.amountHT && data.amountTTC && !data.vatAmount) {
      data.vatAmount = Number(data.amountTTC) - Number(data.amountHT);
      if (data.amountHT > 0) {
        data.vatRate = Number(data.vatAmount) / Number(data.amountHT);
      }
    }

    // Si taux TVA non trouvé mais montants disponibles
    if (data.amountHT && data.vatAmount && !data.vatRate) {
      data.vatRate = Number(data.vatAmount) / Number(data.amountHT);
    }

    return {
      ...data,
      rawOcrData: document, // Conserver les données brutes
    };
  }

  private parseAmount(value: any): number | null {
    if (!value) return null;
    
    // Si c'est déjà un nombre (normalizedValue.moneyValue)
    if (typeof value === 'object' && value.currencyCode) {
      return parseFloat(value.nanos ? `${value.units}.${value.nanos}` : value.units.toString());
    }
    
    // Extraire les nombres (gérer formats: "123,45 €", "123.45", etc.)
    const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
  }

  private parseRate(value: any): number | null {
    if (!value) return null;
    
    // Si c'est déjà un nombre
    if (typeof value === 'number') {
      return value > 1 ? value / 100 : value;
    }
    
    // Extraire le taux (gérer "20%", "0.20", etc.)
    const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
    const rate = parseFloat(cleaned);
    if (isNaN(rate)) return null;
    // Si c'est un pourcentage (ex: 20), convertir en décimal (0.20)
    return rate > 1 ? rate / 100 : rate;
  }

  private parseDate(value: any): Date | null {
    if (!value) return null;
    
    // Si c'est déjà une date
    if (value instanceof Date) {
      return value;
    }
    
    // Si c'est un objet date normalisé
    if (typeof value === 'object' && value.year) {
      return new Date(value.year, (value.month || 1) - 1, value.day || 1);
    }
    
    // Parser différentes formats de dates françaises
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
}

