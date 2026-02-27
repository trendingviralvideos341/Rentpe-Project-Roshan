"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Users, Calendar, AlertTriangle, RotateCcw, Skull } from "lucide-react";
import { getUsers } from "@/actions/admin";
import { adminDeleteUser, adminDeleteBooking, adminRestoreUser, adminRestoreBooking, adminPurgeUser, adminPurgeBooking } from "@/actions/admin";
import { getBookings } from "@/actions/bookings";

export default function AdminDataManagementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"users" | "bookings">("users");
    const [showDeleted, setShowDeleted] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; name: string; action: "archive" | "purge" } | null>(null);
    const [purgeConfirmText, setPurgeConfirmText] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [u, b] = await Promise.all([getUsers(), getBookings()]);
            setUsers(u);
            setBookings(b);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAction = async () => {
        if (!confirmDelete) return;
        try {
            if (confirmDelete.action === "archive") {
                if (confirmDelete.type === "user") await adminDeleteUser(confirmDelete.id);
                else if (confirmDelete.type === "booking") await adminDeleteBooking(confirmDelete.id);
            } else {
                if (confirmDelete.type === "user") await adminPurgeUser(confirmDelete.id);
                else if (confirmDelete.type === "booking") await adminPurgeBooking(confirmDelete.id);
            }
            setConfirmDelete(null);
            setPurgeConfirmText("");
            fetchData();
        } catch (e: any) {
            alert(`Action failed: ${e.message}`);
        }
    };

    const handleRestore = async (type: string, id: string) => {
        try {
            if (type === "user") await adminRestoreUser(id);
            else if (type === "booking") await adminRestoreBooking(id);
            fetchData();
        } catch (e: any) {
            alert(`Restore failed: ${e.message}`);
        }
    };

    const activeUsers = users.filter(u => !u.deletedAt);
    const deletedUsers = users.filter(u => u.deletedAt);
    const activeBookings = bookings.filter(b => !b.deletedAt);
    const deletedBookings = bookings.filter(b => b.deletedAt);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading data...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-red-700">⚠️ Data Management</h1>
                <p className="text-muted-foreground">Archive or permanently purge platform data.</p>
            </div>

            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-bold text-red-700">Danger Zone</p>
                    <p className="text-sm text-red-600">
                        <strong>Archive</strong> = soft-delete (recoverable). <strong>Purge</strong> = permanent, requires typing DELETE. Only the main admin should perform these actions.
                    </p>
                </div>
            </div>

            {/* Colored Tab Selector */}
            <div className="flex gap-2">
                <Button
                    onClick={() => setTab("users")}
                    className={tab === "users" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-white border border-blue-300 text-blue-700 hover:bg-blue-50"}
                >
                    <Users className="h-4 w-4 mr-2" /> Users ({activeUsers.length})
                </Button>
                <Button
                    onClick={() => setTab("bookings")}
                    className={tab === "bookings" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-white border border-green-300 text-green-700 hover:bg-green-50"}
                >
                    <Calendar className="h-4 w-4 mr-2" /> Bookings ({activeBookings.length})
                </Button>
                <Button
                    variant="outline"
                    onClick={() => setShowDeleted(!showDeleted)}
                    className={showDeleted ? "bg-orange-100 border-orange-400 text-orange-700" : "border-orange-300 text-orange-600 hover:bg-orange-50"}
                >
                    🗑️ Archived ({tab === "users" ? deletedUsers.length : deletedBookings.length})
                </Button>
            </div>

            {/* Active Records */}
            {!showDeleted && (
                <Card>
                    <CardContent className="p-0">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">ID</th>
                                    <th className="p-4 text-left font-medium">{tab === "users" ? "Name" : "Guest"}</th>
                                    <th className="p-4 text-left font-medium">{tab === "users" ? "Email" : "Property"}</th>
                                    <th className="p-4 text-left font-medium">{tab === "users" ? "Role" : "Status"}</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tab === "users" && activeUsers.map(u => (
                                    <tr key={u.id} className="border-b hover:bg-muted/5">
                                        <td className="p-4 text-xs text-muted-foreground font-mono">{u.displayId || u.id.slice(0, 8)}</td>
                                        <td className="p-4 font-medium">{u.name}</td>
                                        <td className="p-4 text-sm">{u.email}</td>
                                        <td className="p-4"><span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{u.role}</span></td>
                                        <td className="p-4 flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                                                onClick={() => setConfirmDelete({ type: "user", id: u.id, name: u.name || u.email, action: "archive" })}>
                                                🗑️ Archive
                                            </Button>
                                            <Button size="sm" variant="destructive" className="h-8 text-xs"
                                                onClick={() => setConfirmDelete({ type: "user", id: u.id, name: u.name || u.email, action: "purge" })}>
                                                <Skull className="h-3 w-3 mr-1" /> Purge
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {tab === "bookings" && activeBookings.map((b: any) => (
                                    <tr key={b.id} className="border-b hover:bg-muted/5">
                                        <td className="p-4 font-medium">{b.displayId}</td>
                                        <td className="p-4">{b.guestName}</td>
                                        <td className="p-4 text-sm">{b.propertyName}</td>
                                        <td className="p-4"><span className="text-xs font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{b.status}</span></td>
                                        <td className="p-4 flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                                                onClick={() => setConfirmDelete({ type: "booking", id: b.id, name: b.displayId, action: "archive" })}>
                                                🗑️ Archive
                                            </Button>
                                            <Button size="sm" variant="destructive" className="h-8 text-xs"
                                                onClick={() => setConfirmDelete({ type: "booking", id: b.id, name: b.displayId, action: "purge" })}>
                                                <Skull className="h-3 w-3 mr-1" /> Purge
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* Archived Records */}
            {showDeleted && (
                <Card className="border-orange-200">
                    <CardContent className="p-0">
                        <div className="p-4 bg-orange-50 border-b border-orange-200">
                            <p className="text-sm font-bold text-orange-700">🗑️ Archived Records — These can be restored</p>
                        </div>
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">ID</th>
                                    <th className="p-4 text-left font-medium">Name</th>
                                    <th className="p-4 text-left font-medium">Archived On</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tab === "users" && deletedUsers.map(u => (
                                    <tr key={u.id} className="border-b bg-orange-50/30">
                                        <td className="p-4 text-xs font-mono">{u.displayId || u.id.slice(0, 8)}</td>
                                        <td className="p-4 line-through text-muted-foreground">{u.name} ({u.email})</td>
                                        <td className="p-4 text-xs">{new Date(u.deletedAt).toLocaleString()}</td>
                                        <td className="p-4 flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50" onClick={() => handleRestore("user", u.id)}>
                                                <RotateCcw className="h-3 w-3 mr-1" /> Restore
                                            </Button>
                                            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => setConfirmDelete({ type: "user", id: u.id, name: u.name || u.email, action: "purge" })}>
                                                <Skull className="h-3 w-3 mr-1" /> Purge
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {tab === "bookings" && deletedBookings.map((b: any) => (
                                    <tr key={b.id} className="border-b bg-orange-50/30">
                                        <td className="p-4 text-xs font-mono">{b.displayId}</td>
                                        <td className="p-4 line-through text-muted-foreground">{b.guestName}</td>
                                        <td className="p-4 text-xs">{new Date(b.deletedAt).toLocaleString()}</td>
                                        <td className="p-4 flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50" onClick={() => handleRestore("booking", b.id)}>
                                                <RotateCcw className="h-3 w-3 mr-1" /> Restore
                                            </Button>
                                            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => setConfirmDelete({ type: "booking", id: b.id, name: b.displayId, action: "purge" })}>
                                                <Skull className="h-3 w-3 mr-1" /> Purge
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {((tab === "users" && deletedUsers.length === 0) || (tab === "bookings" && deletedBookings.length === 0)) && (
                                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No archived records.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* Confirm Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${confirmDelete.action === "purge" ? "bg-red-100" : "bg-orange-100"}`}>
                                {confirmDelete.action === "purge" ? <Skull className="h-6 w-6 text-red-600" /> : <Trash2 className="h-6 w-6 text-orange-600" />}
                            </div>
                            <div>
                                <h2 className={`text-xl font-bold ${confirmDelete.action === "purge" ? "text-red-700" : "text-orange-700"}`}>
                                    {confirmDelete.action === "purge" ? "Purge Permanently?" : "Archive Record?"}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {confirmDelete.action === "purge" ? "This CANNOT be undone." : "Can be restored later from Archived tab."}
                                </p>
                            </div>
                        </div>
                        <div className={`border rounded p-3 text-sm ${confirmDelete.action === "purge" ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"}`}>
                            {confirmDelete.action === "purge" ? "Permanently purging" : "Archiving"}: <strong>{confirmDelete.name}</strong> ({confirmDelete.type})
                        </div>
                        {confirmDelete.action === "purge" && (
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-red-700">Type <code className="bg-red-100 px-1 rounded">DELETE</code> to confirm:</p>
                                <Input
                                    placeholder="Type DELETE here..."
                                    value={purgeConfirmText}
                                    onChange={e => setPurgeConfirmText(e.target.value)}
                                    className="border-red-300 focus:border-red-500"
                                />
                            </div>
                        )}
                        <div className="flex gap-3">
                            <Button
                                variant={confirmDelete.action === "purge" ? "destructive" : "default"}
                                className={`flex-1 ${confirmDelete.action === "archive" ? "bg-orange-600 hover:bg-orange-700" : ""}`}
                                disabled={confirmDelete.action === "purge" && purgeConfirmText !== "DELETE"}
                                onClick={handleAction}
                            >
                                {confirmDelete.action === "purge" ? "Yes, Purge Permanently" : "Yes, Archive"}
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={() => { setConfirmDelete(null); setPurgeConfirmText(""); }}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
