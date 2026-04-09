import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: { foodMenu: { take: 1, orderBy: { id: 'asc' } } }
    });
    if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const foodMenu = (property as any).foodMenu?.[0];
    return NextResponse.json({
        propertyName: property.name,
        weeklyMenu: foodMenu?.weeklyMenu || '{}',
        menuVersion: (foodMenu as any)?.menuVersion ?? 0,
    });
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes((session as any).role)) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { propertyId, weeklyMenu } = await req.json();
    if (!propertyId || !weeklyMenu) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    const userId = (session as any).userId;

    // Upsert: update first FoodMenu row for property, or create one
    const existing = await prisma.foodMenu.findFirst({ where: { propertyId } });
    let result;
    if (existing) {
        result = await prisma.foodMenu.update({
            where: { id: existing.id },
            data: {
                weeklyMenu: JSON.stringify(weeklyMenu),
                updatedBy: userId,
                menuVersion: { increment: 1 },
            }
        });
    } else {
        result = await prisma.foodMenu.create({
            data: {
                propertyId,
                dayOfWeek: 'WEEKLY',
                mealType: 'ALL',
                items: '{}',
                weeklyMenu: JSON.stringify(weeklyMenu),
                updatedBy: userId,
                menuVersion: 1,
            }
        });
    }

    logAuditEvent({
        actorId: userId,
        actorRole: (session as any).role,
        actorName: (session as any).name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'FOOD_MENU',
        entityId: result.id,
        description: `Weekly food menu updated for property ${propertyId}`,
    });

    return NextResponse.json({ success: true, menuVersion: result.menuVersion });
}
