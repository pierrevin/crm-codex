import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from '../src/app.module';
import { ImportsService } from '../src/imports/imports.service';

async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );

  const imports = app.get(ImportsService);
  const dryRunEnv = (process.env.DRY_RUN ?? 'true').toString().toLowerCase();
  const dryRun = dryRunEnv !== 'false';

  // Exécute l'import Axonaut depuis les fichiers du serveur (BDD_archives)
  // Rapport: totaux créés/mis à jour et erreurs
  // Ne modifie rien si dryRun = true
  // eslint-disable-next-line no-console
  console.log(`[import] Starting Axonaut import from server files (dryRun=${dryRun})`);
  const report = await imports.importAxonautFromServerFiles(dryRun);
  // eslint-disable-next-line no-console
  console.log(`[import] Report: ${JSON.stringify(report, null, 2)}`);

  await app.close();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});


