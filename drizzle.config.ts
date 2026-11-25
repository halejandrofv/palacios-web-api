import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/modules/business-profile/external-system/persistence/d1/schema.ts',
  out: './drizzle',
});
