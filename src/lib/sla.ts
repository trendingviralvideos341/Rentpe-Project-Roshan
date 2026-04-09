/**
 * SLA (Service Level Agreement) utilities for support tickets.
 * Pure client-safe functions — no server imports.
 */

export function getSLAStatus(ticket: {
    priority: string;
    createdAt: Date | string;
    status: string;
}): 'ON_TIME' | 'WARNING' | 'BREACHED' {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return 'ON_TIME';

    const slaHours: Record<string, number> = {
        URGENT: 4,
        HIGH: 24,
        MEDIUM: 72,
        LOW: 168, // 7 days
    };

    const hours = slaHours[ticket.priority] || 72;
    const slaDeadline = new Date(new Date(ticket.createdAt).getTime() + hours * 60 * 60 * 1000);
    const now = new Date();
    const msRemaining = slaDeadline.getTime() - now.getTime();
    const totalMs = hours * 60 * 60 * 1000;

    if (msRemaining < 0) return 'BREACHED';
    if (msRemaining < totalMs * 0.2) return 'WARNING'; // Last 20% of window
    return 'ON_TIME';
}

export function getSLARemainingLabel(ticket: {
    priority: string;
    createdAt: Date | string;
    status: string;
}): string {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return 'Resolved';

    const slaHours: Record<string, number> = {
        URGENT: 4,
        HIGH: 24,
        MEDIUM: 72,
        LOW: 168,
    };

    const hours = slaHours[ticket.priority] || 72;
    const deadline = new Date(new Date(ticket.createdAt).getTime() + hours * 60 * 60 * 1000);
    const ms = deadline.getTime() - Date.now();

    if (ms < 0) return 'SLA Breached';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 48) return `${Math.floor(h / 24)}d remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
}
