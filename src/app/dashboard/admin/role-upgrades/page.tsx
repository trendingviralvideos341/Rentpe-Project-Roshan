import { getAllUpgradeRequests } from '@/actions/roleUpgrade';
import { RoleUpgradesClient } from './RoleUpgradesClient';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Role Upgrade Requests | RentPe Admin',
    description: 'Review and manage Student to Owner upgrade applications on RentPe.'
};

export default async function RoleUpgradesPage() {
    const session = await getSession();
    if (!session?.userId) redirect('/login');

    const roles: string[] = Array.isArray((session as any).roles) ? (session as any).roles : [(session as any).role];
    if (!roles.includes('ADMIN') && (session as any).role !== 'ADMIN') {
        redirect('/dashboard/student');
    }

    const requests = await getAllUpgradeRequests();

    return <RoleUpgradesClient initialRequests={requests} />;
}
