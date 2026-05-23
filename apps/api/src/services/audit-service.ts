import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { auditEventInputSchema } from "@revealth/contracts";
import { AuditRepository, type DatabaseClient } from "@revealth/database";
import type { z } from "zod";

export function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class AuditService {
  private readonly repository: AuditRepository;

  constructor(db: DatabaseClient) {
    this.repository = new AuditRepository(db);
  }

  append(input: z.input<typeof auditEventInputSchema>) {
    const validated = auditEventInputSchema.parse(input);
    return this.repository.append(validated as Prisma.AuditLogUncheckedCreateInput);
  }
}
