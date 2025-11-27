# Variables d'environnement nécessaires

Copiez ces variables dans votre fichier `.env` à la racine du projet ou dans `backend/.env` :

```bash
# Configuration du serveur
PORT=3000

# JWT Configuration
JWT_ACCESS_SECRET=your-access-secret-here
JWT_ACCESS_EXPIRES_IN=900s
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-google-drive-folder-id

# Google Document AI (pour le scan de factures)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=projects/YOUR_PROJECT_ID/locations/YOUR_LOCATION/processors/YOUR_PROCESSOR_ID
GOOGLE_CLIENT_EMAIL=document-ai-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXX\n-----END PRIVATE KEY-----\n"
# Alternative pour Supabase/Vercel : clé privée encodée en base64 (optionnel, remplace GOOGLE_PRIVATE_KEY)
GOOGLE_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCg...

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=expenses

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Application
WEB_APP_URL=http://localhost:5173
MAKE_WEBHOOK_SECRET=your-make-webhook-secret
VITE_API_URL=https://your-project.supabase.co/functions/v1
VITE_EXPENSES_API_URL=https://your-project.supabase.co/functions/v1/expenses

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
```

## Variables spécifiques au système de dépenses

Les variables suivantes sont nécessaires pour le système de scan de factures :

- `GOOGLE_APPLICATION_CREDENTIALS` : Chemin vers le fichier JSON du compte de service Google Cloud
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` : ID du processeur Document AI créé dans Google Cloud
- `SUPABASE_URL` : URL de votre projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé de service Supabase (trouvable dans Settings > API)
- `SUPABASE_STORAGE_BUCKET` : Nom du bucket (par défaut: `expenses`)
- `GOOGLE_PRIVATE_KEY_BASE64` : même clé que `GOOGLE_PRIVATE_KEY` mais encodée en base64 pour être injectée facilement via `supabase secrets set` ou les variables masquées Vercel (laisser vide si vous utilisez directement `GOOGLE_PRIVATE_KEY`)

Voir `EXPENSES_SETUP.md` pour les instructions détaillées de configuration.

