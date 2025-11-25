import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class SupabaseStorageService {
  private supabase: SupabaseClient;
  private bucketName: string;

  constructor(private config: ConfigService) {
    const appConfig = this.config.get<AppConfig>('app')!;
    this.bucketName = appConfig.supabase.storageBucket;
    
    this.supabase = createClient(
      appConfig.supabase.url,
      appConfig.supabase.serviceRoleKey
    );
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string
  ): Promise<string> {
    // Organiser par dossiers (année/mois)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const filePath = `${year}/${month}/${userId}/${Date.now()}-${fileName}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload file to Supabase Storage: ${error.message}`);
    }

    // Générer une URL signée (valide 1 an)
    const { data: urlData } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, 31536000); // 1 an en secondes

    if (!urlData?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    return urlData.signedUrl;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // Extraire le chemin du fichier depuis l'URL
    const urlParts = fileUrl.split('/');
    const filePath = urlParts.slice(urlParts.indexOf(this.bucketName) + 1).join('/');

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file from Supabase Storage: ${error.message}`);
    }
  }

  async getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error || !data?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    return data.signedUrl;
  }
}

