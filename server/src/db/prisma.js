// ============================================================
// Prisma Client singleton
// ============================================================
// One shared PrismaClient for the whole server. SQLite file lives at
// prisma/data.db (see prisma/schema.prisma + server/.env DATABASE_URL).
// ============================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
