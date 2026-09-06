// backend/prisma.config.ts
import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "prisma/schema.prisma", // Pfad zu deinem Schema
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
});
