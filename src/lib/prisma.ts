import "dotenv/config";
import { PrismaClient } from '@prisma/client';

// Models that support soft-delete (have a deletedAt field)
const SOFT_DELETE_MODELS = ['User', 'Property', 'Room', 'Bed', 'Booking', 'Tenancy'] as const;
const READ_OPS = ['findMany', 'findFirst', 'findUnique', 'count'] as const;

const prismaClientSingleton = () => {
    const client = new PrismaClient();

    // ─── Global Soft-Delete Filter (Prisma 6 — $extends) ──────────────────────
    return client.$extends({
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }: any) {
                    if (
                        SOFT_DELETE_MODELS.includes(model) &&
                        READ_OPS.includes(operation)
                    ) {
                        // Inject deletedAt: null so deleted records are invisible
                        args.where = { ...args.where, deletedAt: null };
                    }
                    return query(args);
                },
            },
        },
    });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

declare global {
    var prisma: PrismaClientSingleton | undefined;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

