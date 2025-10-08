# CRM Codex

CRM Codex est un MVP CRM single-user construit avec NestJS, Prisma, React et Vite. Il offre une base prête pour la production avec authentification JWT, webhooks compatibles Make, import CSV et synchronisation Google Calendar.

## Démarrage rapide

```bash
cp .env.example .env
# adapter les valeurs sensibles puis
npm install --prefix backend
npm install --prefix frontend
npx prisma generate --schema=prisma/schema.prisma --cwd backend
```

### Aperçu instantané (sans installation)

Pour visualiser rapidement l'interface sans configurer Node.js ni la base de données, ouvrez simplement le fichier
[`preview/index.html`](preview/index.html) dans votre navigateur. Il s'agit d'une maquette statique fidèle aux pages
principales (contacts, fiche, opportunités, activités, import CSV) avec des données d'exemple.

### Aperçu local rapide

Pour un aperçu connecté (API NestJS + React), lancez les serveurs de développement dans deux terminaux :

```bash
npm run start:dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

Le backend écoute sur `http://localhost:3000` et le frontend Vite sur `http://localhost:5173`.

### Publier ce projet sur votre dépôt GitHub

Les fichiers présents dans ce dossier ne sont pas automatiquement poussés vers GitHub : ils ne vivent que dans votre
environnement local (ou dans cet espace de travail). Pour les rendre visibles sur votre compte GitHub, créez un dépôt
vide puis poussez-y le code existant :

1. Initialisez le dépôt distant côté GitHub (bouton **New repository**).
2. Dans ce projet, configurez le remote et poussez l'historique :

   ```bash
   git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
   git branch -M main
   git push -u origin main
   ```

3. Pour les mises à jour suivantes, committez puis poussez simplement :

   ```bash
   git add .
   git commit -m "feat: votre message"
   git push
   ```

> 💡 Si vous avez déjà un remote configuré mais que vous ne voyez toujours rien en ligne, vérifiez que vous poussez bien
> sur la branche suivie (`git status` indique la branche courante) et que vous disposez des droits d'écriture sur le dépôt
> GitHub ciblé.

### Pile complète via Docker

```bash
docker-compose up --build
```

L'API est disponible sur `http://localhost:3000`, l'interface web sur `http://localhost:5173`.

### Déployer un aperçu dynamique (beta)

Pour proposer un aperçu interactif à vos testeurs, vous pouvez réutiliser la pile Docker en mode production sur un
serveur ou une plateforme managée compatible Docker (Render, Railway, Fly.io, DigitalOcean Droplet, etc.).

1. **Préparez les variables d'environnement** : copiez `.env.example` vers `.env.beta` et remplissez les valeurs
   sensibles (JWT_SECRET, DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, etc.).
2. **Provisionnez la base de données** : créez une base PostgreSQL accessible depuis votre serveur (managed DB ou
   conteneur Docker). Si vous utilisez le conteneur fourni par `docker-compose.yml`, assurez-vous d'ouvrir les ports
   nécessaires uniquement au sein du réseau privé ou via un tunnel sécurisé.
3. **Lancez la pile en mode détaché** :

   ```bash
   docker compose --env-file .env.beta up -d --build
   ```

   Cette commande construit les images frontend/backend, applique les migrations Prisma au démarrage puis expose :
   - l'API NestJS sur `http://<votre-domaine-ou-ip>:3000`
   - le frontend Vite buildé sur `http://<votre-domaine-ou-ip>:5173`

4. **Protégez l'accès** :
   - Activez HTTPS via un reverse proxy (Caddy, Traefik, Nginx + Let’s Encrypt).
   - Facultatif : restreignez l'accès par IP ou mot de passe HTTP de base si vous souhaitez limiter l'aperçu à un
     cercle restreint.
5. **Synchronisation Google** : sur le domaine public, configurez l'écran de consentement OAuth2 et redirigez
   `GOOGLE_REDIRECT_URI` vers `https://<votre-domaine>/api/google/oauth/callback` pour autoriser la récupération des
   événements Calendar.

> 💡 Astuce : pour mettre à jour l'aperçu, relancez simplement la commande `docker compose up -d --build`. Les conteneurs
> reconstruits déploieront automatiquement la dernière version du frontend et du backend.

### Utiliser Supabase comme base PostgreSQL managée

Oui, Supabase est pleinement compatible : le backend consomme une base PostgreSQL standard via Prisma.

1. Dans le dashboard Supabase, créez un projet et récupérez l'URL de connexion **pooler** (protocole `postgres://`).
2. Copiez cette URL dans la variable `DATABASE_URL` de votre `.env` (veillez à garder `?pgbouncer=true&connection_limit=1`
   si vous utilisez le pooler transactionnel Supabase).
3. Exécutez les migrations Prisma depuis votre machine CI/CD ou serveur :

   ```bash
   npm install --prefix backend
   npx prisma migrate deploy --schema=prisma/schema.prisma --cwd backend
   ```

4. Seed initial :

   ```bash
   npm run seed --prefix backend
   ```

Les refresh tokens, webhooks et journaux d'audit sont stockés en base comme dans toute instance PostgreSQL. Pensez à
configurer les règles réseau Supabase (IP allow list) pour que votre backend puisse se connecter.

### Déployer le frontend sur Vercel

Le bundle React/Vite se déploie sans modification sur Vercel. Déployez-le comme application Vite puis pointez l'API vers
votre backend (Docker sur un VPS, Render, Railway, Fly.io, etc.).

1. Ajoutez un nouveau projet Vercel, importez ce dépôt et sélectionnez `frontend` comme dossier racine.
2. Définissez les variables d'environnement nécessaires (ex. `VITE_API_URL=https://votre-api.example.com`).
3. Laissez Vercel installer les dépendances puis builder via `npm run build`.

> ℹ️ Le backend NestJS nécessite un environnement Node long-running (Docker, VM, Render, Railway…). Vercel Functions ne
> convient pas pour les WebSockets ni les tâches planifiées (Google sync). Déployez donc uniquement le frontend sur Vercel
> et exposez l'API depuis une plateforme supportant les conteneurs ou processus persistants.

## Scripts utiles

- `npm run prisma:migrate` (backend) — applique les migrations
- `npm run seed` (backend) — crée l'admin défini dans les variables d'environnement
- `npm test` (backend) — lance les tests Jest
- `npm run build` (frontend/backend) — builds de production

## Fonctionnalités clés

- Stack Docker incluant Redis (optionnel pour jobs asynchrones)

- Authentification JWT avec refresh tokens persistés (single-user admin)
- Modules CRUD : contacts, entreprises, opportunités, activités
- Import CSV avec parsing simple
- Webhooks configurables (`contact.created`, `contact.updated`, `opportunity.updated`, `activity.created`)
- Synchronisation Google Calendar (OAuth2, import d'évènements)
- Listing Gmail (readonly) via l'endpoint `/api/google/gmail/messages`
- Pagination cursor-based sur les endpoints list
- Documentation OpenAPI sur `/api/docs`
- Frontend React + Tailwind : listes et formulaires principaux

## Checklist d'acceptation

- [x] Création / mise à jour contact, opportunité, activité
- [x] Import CSV basique
- [x] Webhooks Make-ready (`POST /api/webhooks/:event`)
- [x] Google Calendar sync
