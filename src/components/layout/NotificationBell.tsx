'use client';

import { useEffect, useState, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";

export default function NotificationBell({ role = 'USER' }: { role?: string }) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        try {
            const [notifs, count] = await Promise.all([
                getNotifications(role),
                getUnreadCount(role)
            ]);
            setNotifications(notifs.filter((n: any) => n.category !== 'TOKEN' && !n.message?.toLowerCase().includes('pay token')));
            setUnreadCount(count);
        } catch (e) { }
    };

    useEffect(() => {
        // Fetch initially - Defer to avoid synchronous setState in effect
        const timer = setTimeout(() => {
            fetchData();
        }, 0);
        
        // Polling loop
        const interval = setInterval(fetchData, 10000);
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleMarkRead = async (id: string) => {
        try {
            await markNotificationRead(id);
            fetchData();
        } catch (e) { }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            fetchData();
        } catch (e) { }
    };

    const formatTime = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Notifications"
                suppressHydrationWarning
            >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-12 w-80 bg-card border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
                        <span className="text-sm font-bold">Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                <CheckCheck className="h-3 w-3" /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((n) => {
                                // Color-code by category
                                const isSharingChange = n.category === 'ROOM_ALLOCATED' && n.message?.toLowerCase().includes('sharing type');
                                const isRoomAlloc = n.category === 'ROOM_ALLOCATED' && !isSharingChange;
                                const isPayment = n.type === 'PAYMENT';

                                const rowBg = !n.isRead
                                    ? isSharingChange ? 'bg-red-50 border-l-4 border-l-red-400'
                                    : isRoomAlloc ? 'bg-amber-50 border-l-4 border-l-amber-400'
                                    : isPayment ? 'bg-green-50 border-l-4 border-l-green-400'
                                    : 'bg-primary/5'
                                    : '';
                                const dotColor = !n.isRead
                                    ? isSharingChange ? 'bg-red-500'
                                    : isRoomAlloc ? 'bg-amber-500'
                                    : isPayment ? 'bg-green-500'
                                    : 'bg-primary'
                                    : 'bg-transparent';
                                const badgeCls = n.isRead
                                    ? 'bg-green-100 text-green-700'
                                    : isSharingChange
                                        ? 'bg-red-100 text-red-700'
                                        : isRoomAlloc ? 'bg-amber-100 text-amber-700'
                                        : isPayment ? 'bg-green-100 text-green-700'
                                        : 'bg-muted text-muted-foreground';
                                const textCls = !n.isRead
                                    ? isSharingChange ? 'font-bold text-red-900'
                                    : isRoomAlloc ? 'font-bold text-amber-900'
                                    : 'font-medium'
                                    : 'text-muted-foreground';

                                return (
                                    <div
                                        key={n.id}
                                        className={`px-4 py-3 border-b last:border-b-0 cursor-pointer hover:opacity-90 transition-all ${rowBg}`}
                                        onClick={() => !n.isRead && handleMarkRead(n.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                                            <div className="flex-1 min-w-0">
                                                {isSharingChange && (
                                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-0.5">⚠️ Sharing Type Changed</p>
                                                )}
                                                <p className={`text-sm leading-snug ${textCls}`}>{n.message}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-muted-foreground">{formatTime(n.createdAt)}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${badgeCls}`}>
                                                        {n.category === 'PROPERTY_UPDATED_BY_ADMIN' ? 'RentPe Support' : (n.category || n.type)}
                                                    </span>
                                                </div>
                                            </div>
                                            {!n.isRead && (
                                                <button className={`shrink-0 ${isSharingChange ? 'text-red-400 hover:text-red-600' : 'text-muted-foreground hover:text-primary'}`} title="Mark as read">
                                                    <Check className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
