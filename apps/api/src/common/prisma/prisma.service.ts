import { PrismaPg } from "@prisma/adapter-pg";
import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { PrismaClient } from "../../generated/prisma/client.js";

const DatabaseUrlSchema = z
  .url()
  .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"));

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = DatabaseUrlSchema.parse(process.env.DATABASE_URL);
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
