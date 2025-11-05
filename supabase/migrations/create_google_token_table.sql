-- Table pour stocker les tokens OAuth Google
-- Cette table stocke les tokens d'accès Google pour chaque utilisateur

-- Supprimer la table si elle existe déjà (pour réinitialiser)
DROP TABLE IF EXISTS "GoogleToken" CASCADE;

-- Créer la table avec les colonnes en camelCase (comme dans le code)
CREATE TABLE "GoogleToken" (
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoogleToken_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "GoogleToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Créer un index pour améliorer les performances
CREATE INDEX "GoogleToken_userId_idx" ON "GoogleToken"("userId");

