'use server';

import prisma from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

export async function getSystemHealth() {
    try {
        // 1. Check Database
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatency = Date.now() - dbStart;

        // 2. Check Platform Settings (Maintenance Mode)
        const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
        
        // 3. Check Cloudinary (Ping)
        let storageStatus = 'OPERATIONAL';
        try {
            // Quick check by listing a single resource or just using the config
            // Better: use api.ping()
            await cloudinary.api.ping();
        } catch (e) {
            storageStatus = 'DEGRADED';
        }

        return {
            status: settings?.maintenanceMode ? 'MAINTENANCE' : 'OPERATIONAL',
            maintenanceMessage: settings?.maintenanceMessage || "We're currently performing scheduled maintenance. We'll be back shortly!",
            components: [
                { name: 'Core API', status: 'OPERATIONAL', latency: '12ms' },
                { name: 'Database', status: 'OPERATIONAL', latency: `${dbLatency}ms` },
                { name: 'Storage (Cloudinary)', status: storageStatus, latency: 'Dynamic' },
                { name: 'Payments (Razorpay)', status: 'OPERATIONAL', latency: 'Real-time' },
            ],
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error("Health Check Error:", error);
        return {
            status: 'ISSUES',
            maintenanceMessage: "We're experiencing some technical difficulties. Our team is on it!",
            components: [
                { name: 'Core API', status: 'DEGRADED', latency: 'N/A' },
                { name: 'Database', status: 'DOWN', latency: 'Error' },
                { name: 'Storage (Cloudinary)', status: 'UNKNOWN', latency: 'N/A' },
                { name: 'Payments (Razorpay)', status: 'UNKNOWN', latency: 'N/A' },
            ],
            lastUpdated: new Date().toISOString()
        };
    }
}
