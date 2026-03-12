"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { markNotificationRead } from "@/actions/notifications";
import { Bell } from "lucide-react";

export default function NotificationSync() {
  const lastFetchedRef = useRef<string[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/notifications/persistent");
        if (!response.ok) return;

        const notifications = await response.json();

        notifications.forEach((notification: any) => {
          // Avoid duplicate toasts for the same notification in one session
          if (lastFetchedRef.current.includes(notification.id)) return;
          lastFetchedRef.current.push(notification.id);

          let metadata = { actionUrl: "/dashboard", actionLabel: "View Details" };
          try {
            if (notification.metadata) {
              metadata = JSON.parse(notification.metadata);
            }
          } catch {}

          toast.info(notification.message, {
            id: notification.id,
            duration: 10000, // Show for 10 seconds or until dismissed
            icon: <Bell className="w-4 h-4 text-indigo-600" />,
            action: {
              label: metadata.actionLabel || "View",
              onClick: () => {
                markNotificationRead(notification.id);
                window.location.href = metadata.actionUrl || "/dashboard";
              },
            },
            cancel: {
              label: "Dismiss",
              onClick: () => {
                markNotificationRead(notification.id);
              }
            }
          });
        });
      } catch {
        // Silent fail on network errors during polling
      }
    };

    // Initial fetch
    fetchNotifications();

    // Poll every 30 seconds for new persistent alerts
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return null; // Side-effect only component
}
