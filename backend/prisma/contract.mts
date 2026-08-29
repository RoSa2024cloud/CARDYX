import { pgTable, text, doublePrecision, timestamp } from "@prisma/orm-postgres/contract";

export const Token = pgTable("Token", {
  id: text("id").primaryKey(),
  policyId: text("policyId").unique(),
  assetName: text("assetName"),
  ticker: text("ticker").nullable(),
  priceAda: doublePrecision("priceAda").default(0.0),
  updatedAt: timestamp("updatedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const Wallet = pgTable("Wallet", {
  id: text("id").primaryKey(),
  address: text("address").unique(),
  stakeAddress: text("stakeAddress").nullable(),
  label: text("label").nullable(),
  lastChecked: timestamp("lastChecked").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
});
