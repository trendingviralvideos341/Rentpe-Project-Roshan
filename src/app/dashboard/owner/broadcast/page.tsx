'use client';

import { useEffect, useState } from 'react';
import { getOwnerRentCollection } from '@/actions/ownerRentCollection';
import { toast } from 'sonner';
import { MessageCircle, Users, IndianRupee, Building, Search, SendHorizonal, ChevronDown } from 'lucide-react';

const TEMPLATES = [
    {
        id: 'rent',
        label: '📋 Rent Reminder',
        text: `Dear {name},\n\nThis is a friendly reminder that your rent of ₹{amount} is due for this month at {property}, Room {room}.\n\nPlease make the payment at your earliest convenience.\n\nThank you,\n${'{ownerName}'}`,
    },
    {
        id: 'maintenance',
        label: '🔧 Maintenance Notice',
        text: `Dear {name},\n\nPlease be informed that there will be maintenance work at {property} on [DATE] from [TIME] to [TIME].\n\nWe apologize for any inconvenience caused.\n\nThank you for your cooperation,\n${'{ownerName}'}`,
    },
    {
        id: 'announcement',
        label: '📣 General Announcement',
        text: `Dear {name},\n\nWe have an important announcement for all residents at {property}.\n\n[YOUR ANNOUNCEMENT HERE]\n\nThank you,\n${'{ownerName}'}`,
    },
];

type Audience = 'all' | 'overdue' | 'property';

export default function BroadcastPage() {
    const [audience, setAudience] = useState<Audience>('all');
    const [message, setMessage] = useState('');
    const [allInvoices, setAllInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [sentCount, setSentCount] = useState(0);
    const [preview, setPreview] = useState<any>(null);
    const [showTemplates, setShowTemplates] = useState(false);

    useEffect(() => {
        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        getOwnerRentCollection(month).then(data => {
            setAllInvoices(data);
            setLoading(false);
        });
    }, []);

    const getRecipients = () => {
        if (audience === 'overdue') return allInvoices.filter(i => i.daysOverdue > 0);
        return allInvoices;
    };

    const recipients = getRecipients();

    const applyTemplate = (template: typeof TEMPLATES[0]) => {
        setMessage(template.text);
        setShowTemplates(false);
    };

    const buildMessage = (inv: any) => {
        return message
            .replace(/{name}/g, inv.tenantName)
            .replace(/{amount}/g, `₹${(inv.amount - inv.paidAmount).toLocaleString('en-IN')}`)
            .replace(/{property}/g, inv.propertyName)
            .replace(/{room}/g, inv.roomNumber)
            .replace(/{ownerName}/g, 'Your PG Owner');
    };

    const handleOpenAll = () => {
        if (!message.trim()) {
            toast.error('Please write a message first');
            return;
        }
        setSending(true);
        let count = 0;

        for (const inv of recipients) {
            if (!inv.tenantPhone) continue;
            const personalizedMsg = buildMessage(inv);
            const waMsg = encodeURIComponent(personalizedMsg);
            const url = `https://wa.me/91${inv.tenantPhone.replace(/\D/g, '')}?text=${waMsg}`;
            setTimeout(() => {
                window.open(url, '_blank');
                count++;
                setSentCount(count);
            }, count * 500); // stagger 500ms per recipient
        }

        setTimeout(() => {
            setSending(false);
            toast.success(`Opened WhatsApp for ${recipients.filter(r => r.tenantPhone).length} tenants`);
        }, recipients.length * 500 + 500);
    };

    const charCount = message.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <MessageCircle className="w-8 h-8" /> WhatsApp Broadcast
                    </h1>
                    <p className="text-teal-200 text-sm font-medium mt-1">Send personalized messages to your tenants</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Composer */}
                    <div className="md:col-span-2 space-y-4">
                        {/* Audience Selector */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 space-y-4">
                            <h2 className="font-black text-slate-900">Select Audience</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: 'all' as Audience, label: 'All Tenants', icon: Users, desc: `${allInvoices.length} tenants` },
                                    { key: 'overdue' as Audience, label: 'Overdue Rent', icon: IndianRupee, desc: `${allInvoices.filter(i => i.daysOverdue > 0).length} tenants` },
                                ].map(opt => (
                                    <button key={opt.key} onClick={() => setAudience(opt.key)}
                                        className={`p-4 rounded-2xl border text-left transition-all ${audience === opt.key ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
                                        <opt.icon className={`w-5 h-5 mb-2 ${audience === opt.key ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <p className="font-black text-slate-900 text-sm">{opt.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message Composer */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="font-black text-slate-900">Compose Message</h2>
                                <div className="relative">
                                    <button onClick={() => setShowTemplates(!showTemplates)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl hover:bg-indigo-100 transition-all">
                                        Quick Templates <ChevronDown className="w-3 h-3" />
                                    </button>
                                    {showTemplates && (
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-20">
                                            {TEMPLATES.map(t => (
                                                <button key={t.id} onClick={() => applyTemplate(t)}
                                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm font-bold text-slate-700 border-b border-slate-50 last:border-0 transition-colors">
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Variables hint */}
                            <div className="flex flex-wrap gap-2">
                                {['{name}', '{property}', '{room}', '{amount}', '{ownerName}'].map(v => (
                                    <button key={v} onClick={() => setMessage(m => m + v)}
                                        className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-black rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-all font-mono">
                                        {v}
                                    </button>
                                ))}
                                <span className="text-xs text-slate-400 font-medium self-center">← Click to insert variable</span>
                            </div>

                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                rows={8}
                                placeholder="Type your message here... Use variables like {name}, {property} for personalization."
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                            <div className="flex justify-between items-center">
                                <p className={`text-xs font-bold ${charCount > 4096 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {charCount} / 4096 characters
                                </p>
                                {charCount > 4096 && (
                                    <p className="text-xs text-red-500 font-bold">Message too long for WhatsApp</p>
                                )}
                            </div>
                        </div>

                        {/* Send Section */}
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                                    <MessageCircle className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900">
                                        Will send to <span className="text-emerald-700">{recipients.filter(r => r.tenantPhone).length}</span> tenants
                                    </p>
                                    <p className="text-xs text-slate-500">{recipients.filter(r => !r.tenantPhone).length} tenants have no phone number</p>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs text-amber-700 font-medium">
                                    ⚠️ <strong>Note:</strong> This opens individual WhatsApp chats one by one. Due to WhatsApp policies, bulk API requires WhatsApp Business API. This feature uses WhatsApp web link scheme.
                                </p>
                            </div>

                            <button
                                onClick={handleOpenAll}
                                disabled={sending || !message.trim() || recipients.length === 0 || charCount > 4096}
                                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 hover:shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                <SendHorizonal className="w-5 h-5" />
                                {sending
                                    ? `Opening WhatsApp... (${sentCount}/${recipients.filter(r => r.tenantPhone).length})`
                                    : `Open WhatsApp for ${recipients.filter(r => r.tenantPhone).length} Recipients`
                                }
                            </button>
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 space-y-4 sticky top-4">
                            <h2 className="font-black text-slate-900">Message Preview</h2>
                            {recipients.length > 0 && message ? (
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                                        Preview for: {recipients[0]?.tenantName}
                                    </p>
                                    <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-none p-4 text-sm text-slate-800 whitespace-pre-wrap font-medium shadow-sm">
                                        {buildMessage(recipients[0])}
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-right mt-1">
                                        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
                                    </p>
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-bold">Write a message to see a preview</p>
                                </div>
                            )}

                            {/* Recipient List */}
                            {recipients.length > 0 && (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Recipients</p>
                                    {recipients.slice(0, 10).map((inv: any) => (
                                        <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                                            <div>
                                                <p className="text-xs font-black text-slate-800">{inv.tenantName}</p>
                                                <p className="text-[10px] text-slate-400">{inv.roomNumber}</p>
                                            </div>
                                            {inv.tenantPhone ? (
                                                <span className="text-[10px] text-emerald-600 font-black">✓ Has phone</span>
                                            ) : (
                                                <span className="text-[10px] text-red-400 font-black">No phone</span>
                                            )}
                                        </div>
                                    ))}
                                    {recipients.length > 10 && (
                                        <p className="text-xs text-slate-400 text-center font-bold">+{recipients.length - 10} more</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
