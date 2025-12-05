import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { AppConfig } from '../config/app.config';
import { UsersService } from '../users/users.service';

@Injectable()
export class GoogleDocsService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService
  ) {}

  private async getDriveClient(userId: string) {
    const user = await this.users.findOne(userId);
    if (!user?.googleRefreshToken) {
      throw new Error('User has not authorized Google access');
    }

    const cfg = this.config.get<AppConfig>('app')!;
    const oauth2Client = new google.auth.OAuth2(
      cfg.google.clientId,
      cfg.google.clientSecret,
      cfg.google.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  private async getDocsClient(userId: string) {
    const user = await this.users.findOne(userId);
    if (!user?.googleRefreshToken) {
      throw new Error('User has not authorized Google access');
    }

    const cfg = this.config.get<AppConfig>('app')!;
    const oauth2Client = new google.auth.OAuth2(
      cfg.google.clientId,
      cfg.google.clientSecret,
      cfg.google.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken
    });

    return google.docs({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Crée un document Google Docs à partir d'un template en remplaçant les placeholders
   * @param templateId ID du document template Google Docs
   * @param replacements Objet avec les clés correspondant aux placeholders {{key}}
   * @param parentFolderId ID du dossier parent où créer le document (dossier de l'opportunité)
   * @param userId ID de l'utilisateur pour l'authentification
   * @returns { id: string, url: string }
   */
  async createFromTemplate(
    templateId: string,
    replacements: Record<string, string>,
    parentFolderId: string,
    userId: string
  ): Promise<{ id: string; url: string }> {
    const drive = await this.getDriveClient(userId);
    const docs = await this.getDocsClient(userId);

    // 1. Copier le template dans le dossier parent
    const copyResponse = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: replacements.title || 'Note de débours',
        parents: parentFolderId ? [parentFolderId] : undefined
      }
    });

    const newDocId = copyResponse.data.id as string;
    if (!newDocId) {
      throw new Error('Failed to copy template');
    }

    // 2. Récupérer le contenu du document
    const doc = await docs.documents.get({ documentId: newDocId });
    if (!doc.data.body?.content) {
      throw new Error('Failed to get document content');
    }

    // 3. Construire les requêtes de remplacement
    const requests: any[] = [];
    const content = doc.data.body.content;

    // Fonction récursive pour trouver tous les textes
    const findTextRuns = (elements: any[]): Array<{ startIndex: number; endIndex: number; text: string }> => {
      const textRuns: Array<{ startIndex: number; endIndex: number; text: string }> = [];
      
      for (const element of elements) {
        if (element.paragraph) {
          for (const paraElement of element.paragraph.elements || []) {
            if (paraElement.textRun) {
              textRuns.push({
                startIndex: paraElement.startIndex || 0,
                endIndex: paraElement.endIndex || 0,
                text: paraElement.textRun.content || ''
              });
            }
          }
        }
        if (element.table) {
          // Parcourir les cellules du tableau
          for (const row of element.table.tableRows || []) {
            for (const cell of row.tableCells || []) {
              if (cell.content) {
                textRuns.push(...findTextRuns(cell.content));
              }
            }
          }
        }
      }
      
      return textRuns;
    };

    const textRuns = findTextRuns(content);

    // 4. Remplacer les placeholders
    for (const [key, value] of Object.entries(replacements)) {
      const placeholder = `{{${key}}}`;
      
      for (const textRun of textRuns) {
        if (textRun.text.includes(placeholder)) {
          // Trouver la position du placeholder dans le texte
          const placeholderIndex = textRun.text.indexOf(placeholder);
          const startIndex = textRun.startIndex + placeholderIndex;
          const endIndex = startIndex + placeholder.length;

          requests.push({
            replaceAllText: {
              containsText: {
                text: placeholder,
                matchCase: false
              },
              replaceText: value
            }
          });
        }
      }
    }

    // 5. Appliquer les remplacements
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: newDocId,
        requestBody: {
          requests
        }
      });
    }

    // 6. Retourner l'ID et l'URL
    const url = `https://docs.google.com/document/d/${newDocId}`;
    
    return {
      id: newDocId,
      url
    };
  }
}

