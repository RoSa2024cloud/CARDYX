import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/schema.prisma", // Zeigt direkt auf deine Textdatei!
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
});
