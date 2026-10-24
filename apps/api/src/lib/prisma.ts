import { PrismaClient } from '@prisma/client';

// Instancia única por proceso.
export const prisma = new PrismaClient();
