'use client';

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
    const router = useRouter();
    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-white bg-red-500 hover:bg-red-600 font-semibold px-4 py-2 rounded-lg shadow-sm"
            onClick={async () => {
                await logout();
                router.push("/login");
                router.refresh();
            }}
        >
            <LogOut className="h-4 w-4 mr-1" />
            Sign Out
        </Button>
    );
}
