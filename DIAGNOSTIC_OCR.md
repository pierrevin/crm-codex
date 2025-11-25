# Diagnostic OCR - Erreur INVALID_ARGUMENT

## Problème actuel
L'OCR Document AI retourne l'erreur `INVALID_ARGUMENT: Request contains an invalid argument.`

## Vérifications effectuées
✅ Client Document AI configuré avec l'endpoint EU (`eu-documentai.googleapis.com`)
✅ Processeur ID au bon format: `projects/982552445969/locations/eu/processors/bf192fa2f51782b4`
✅ Credentials Google Cloud configurés (`GOOGLE_APPLICATION_CREDENTIALS`)
✅ Format de fichier supporté (PDF, JPG, PNG)
✅ MimeType normalisé correctement

## Causes possibles restantes

### 1. Permissions du compte de service
Vérifiez que le compte de service a bien le rôle **"Document AI API User"** :
- Allez dans Google Cloud Console → IAM & Admin → IAM
- Trouvez votre compte de service (celui utilisé dans `service-account-key.json`)
- Vérifiez qu'il a le rôle `roles/documentai.apiUser` ou `roles/documentai.apiUserBeta`

### 2. Type de processeur
Vous avez mentionné deux processeurs :
- **Invoice Parser**: `bf192fa2f51782b4`
- **Form Parser**: `2846401a13b8f0ec`

Assurez-vous d'utiliser le bon processeur dans `.env` :
```
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=projects/982552445969/locations/eu/processors/bf192fa2f51782b4
```

### 3. API activée
Vérifiez que l'API Document AI est bien activée :
- Google Cloud Console → APIs & Services → Enabled APIs
- Cherchez "Document AI API" et vérifiez qu'elle est activée

### 4. Test direct avec gcloud
Testez directement avec la CLI Google Cloud pour isoler le problème :

```bash
# Installer gcloud CLI si nécessaire
# Puis tester :
gcloud auth activate-service-account --key-file="/Users/pierre/CRM codex/crm-codex/backend/config/service-account-key.json"

# Tester avec un fichier PDF
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://eu-documentai.googleapis.com/v1/projects/982552445969/locations/eu/processors/bf192fa2f51782b4:process" \
  -d '{
    "rawDocument": {
      "content": "'$(base64 -i votre-fichier.pdf)'",
      "mimeType": "application/pdf"
    }
  }'
```

### 5. Vérifier les logs Google Cloud
- Google Cloud Console → Logging → Logs Explorer
- Filtrez par : `resource.type="documentai.googleapis.com/Processor"`
- Cherchez les erreurs récentes

## Solution de contournement actuelle
Le système crée quand même la dépense même si l'OCR échoue, permettant de remplir les informations manuellement.

## Prochaines étapes
1. Vérifier les permissions du compte de service
2. Tester avec le Form Parser au lieu de l'Invoice Parser
3. Vérifier les logs Google Cloud pour plus de détails
4. Tester avec un fichier différent (format, taille)

