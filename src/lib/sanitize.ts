/**
 * Strips fields that must never be overwritten via an update action.
 * - id        → primary key, immutable
 * - displayId → sequential ID, immutable post-creation
 * - createdAt → timestamp, immutable
 *
 * Usage:
 *   const safeData = stripImmutableFields(data);
 *   await prisma.x.update({ where: { id: resourceId }, data: safeData });
 */
export function stripImmutableFields<T extends Record<string, any>>(data: T): Omit<T, 'id' | 'displayId' | 'createdAt'> {
    const { id, displayId, createdAt, ...safeData } = data;
    return safeData;
}
