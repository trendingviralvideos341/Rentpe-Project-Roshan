"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { teamSubmitOnboarding } from "@/actions/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OnboarderNewFieldVisitPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isIndian, setIsIndian] = useState(true);
    const [pincodeLoading, setPincodeLoading] = useState(false);

    const [form, setForm] = useState({
        ownerName: "", ownerEmail: "", ownerPhone: "",
        buildingName: "", address: "", city: "", pincode: "", country: "India",
        pgLicenceNumber: "", notes: "",
    });
    const [docs, setDocs] = useState<Record<string, string>>({});
    const [docNames, setDocNames] = useState<Record<string, string>>({});
    const [additionalPhotos, setAdditionalPhotos] = useState<{ name: string; data: string }[]>([]);

    function updateField(field: string, value: string) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function handlePhoneInput(val: string) {
        const digits = val.replace(/\D/g, "").slice(0, 10);
        updateField("ownerPhone", digits);
    }

    async function handlePincodeChange(val: string) {
        const digits = val.replace(/\D/g, "").slice(0, 6);
        updateField("pincode", digits);
        if (isIndian && digits.length === 6) {
            setPincodeLoading(true);
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${digits}`);
                const data = await res.json();
                if (data?.[0]?.Status === "Success" && data[0].PostOffice?.[0]) {
                    const po = data[0].PostOffice[0];
                    setForm(prev => ({ ...prev, pincode: digits, city: po.District || po.Division || prev.city, country: "India" }));
                }
            } catch { /* ignore */ }
            finally { setPincodeLoading(false); }
        }
    }

    async function toBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handleDocUpload(field: string, file: File) {
        const data = await toBase64(file);
        setDocs(prev => ({ ...prev, [field]: data }));
        setDocNames(prev => ({ ...prev, [field]: file.name }));
    }

    async function handleAdditionalPhotos(files: FileList) {
        const newPhotos = await Promise.all(
            Array.from(files).map(async f => ({ name: f.name, data: await toBase64(f) }))
        );
        setAdditionalPhotos(prev => [...prev, ...newPhotos]);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!form.ownerName || !form.ownerEmail || !form.ownerPhone || !form.buildingName || !form.address || !form.city || !form.pincode) {
            setError("Please fill all required fields."); return;
        }
        if (isIndian && form.ownerPhone.length !== 10) { setError("Phone must be 10 digits."); return; }

        setLoading(true);
        try {
            await teamSubmitOnboarding({
                ...form,
                ownerPhone: isIndian ? `+91${form.ownerPhone}` : form.ownerPhone,
                idProofData: docs.idProof || undefined,
                idProofName: docNames.idProof || undefined,
                pgLicenceData: docs.pgLicence || undefined,
                pgLicenceName: docNames.pgLicence || undefined,
                buildingImageData: docs.buildingImage || undefined,
                buildingImageName: docNames.buildingImage || undefined,
                additionalPhotos: JSON.stringify(additionalPhotos),
            });
            router.push("/dashboard/onboarder?submitted=1");
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/onboarder"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
                <div>
                    <h1 className="text-3xl font-bold">New Field Visit</h1>
                    <p className="text-muted-foreground">Onboard an owner from a site visit — goes directly to Verification queue</p>
                </div>
            </div>

            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Citizen toggle */}
                <div className="flex gap-2">
                    {[{ v: true, l: "🇮🇳 Indian Citizen" }, { v: false, l: "🌍 International" }].map(opt => (
                        <button key={String(opt.v)} type="button"
                            onClick={() => { setIsIndian(opt.v); if (opt.v) updateField("country", "India"); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition border-2 ${isIndian === opt.v ? "border-purple-500 bg-purple-50 text-purple-700" : "border-border text-muted-foreground hover:bg-muted"}`}>
                            {opt.l}
                        </button>
                    ))}
                </div>

                {/* Owner Details */}
                <Card>
                    <CardHeader><CardTitle className="text-base">👤 Owner Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Owner Name *</label>
                                <Input value={form.ownerName} onChange={e => updateField("ownerName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} placeholder="Full name" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Email *</label>
                                <Input type="email" value={form.ownerEmail} onChange={e => updateField("ownerEmail", e.target.value)} placeholder="owner@example.com" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Phone *</label>
                                <div className="flex gap-2 items-center">
                                    {isIndian && <span className="text-sm font-medium bg-muted px-3 py-2 rounded-md">🇮🇳 +91</span>}
                                    <Input value={form.ownerPhone} onChange={e => handlePhoneInput(e.target.value)}
                                        placeholder={isIndian ? "10-digit number" : "Phone with country code"} className="flex-1" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Building Details */}
                <Card>
                    <CardHeader><CardTitle className="text-base">🏢 Building Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Building Name *</label>
                                <Input value={form.buildingName} onChange={e => updateField("buildingName", e.target.value)} placeholder="PG / Hostel name" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">PG Licence #</label>
                                <Input value={form.pgLicenceNumber} onChange={e => updateField("pgLicenceNumber", e.target.value)} placeholder="Optional" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Address *</label>
                            <Input value={form.address} onChange={e => updateField("address", e.target.value)} placeholder="Full street address" />
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Pincode *</label>
                                <div className="relative">
                                    <Input value={form.pincode} onChange={e => handlePincodeChange(e.target.value)} placeholder={isIndian ? "6-digit" : "Postal code"} />
                                    {pincodeLoading && <span className="absolute right-3 top-2.5 text-xs text-muted-foreground animate-pulse">fetching...</span>}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">City *</label>
                                <Input value={form.city} onChange={e => updateField("city", e.target.value)} placeholder="City" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Country</label>
                                <Input value={form.country} onChange={e => updateField("country", e.target.value)} disabled={isIndian} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Documents */}
                <Card>
                    <CardHeader><CardTitle className="text-base">📎 Documents & Photos</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-3">
                            {[
                                { field: "idProof", label: "🪪 Owner ID Proof", desc: "Aadhaar / PAN / Passport" },
                                { field: "pgLicence", label: "📄 PG Licence", desc: "Hostel / PG licence copy" },
                                { field: "buildingImage", label: "🏠 Building Photo", desc: "Front view of building" },
                            ].map(({ field, label, desc }) => {
                                const uploaded = docNames[field];
                                return (
                                    <label key={field} className={`cursor-pointer border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 transition hover:border-purple-400 text-center ${uploaded ? "border-green-400 bg-green-50" : "border-border"}`}>
                                        {uploaded ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                                        <span className="text-sm font-semibold">{label}</span>
                                        <span className="text-xs text-muted-foreground">{uploaded || desc}</span>
                                        <input type="file" className="hidden" accept="image/*,application/pdf"
                                            onChange={e => { if (e.target.files?.[0]) handleDocUpload(field, e.target.files[0]); }} />
                                    </label>
                                );
                            })}
                        </div>
                        <label className="cursor-pointer border-2 border-dashed rounded-xl p-4 flex items-center gap-4 hover:border-purple-400 transition">
                            <Upload className="h-6 w-6 text-muted-foreground shrink-0" />
                            <div>
                                <p className="text-sm font-semibold">📷 Additional Photos (multi-select)</p>
                                <p className="text-xs text-muted-foreground">
                                    {additionalPhotos.length > 0 ? `${additionalPhotos.length} photo(s) selected` : "Rooms, common areas, etc."}
                                </p>
                            </div>
                            <input type="file" className="hidden" multiple accept="image/*"
                                onChange={e => { if (e.target.files) handleAdditionalPhotos(e.target.files); }} />
                        </label>
                    </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                    <CardHeader><CardTitle className="text-base">📝 Notes / Remarks</CardTitle></CardHeader>
                    <CardContent>
                        <textarea className="w-full border rounded-lg p-3 text-sm min-h-[80px] resize-y focus:ring-2 focus:ring-purple-300 focus:outline-none"
                            value={form.notes} onChange={e => updateField("notes", e.target.value)} placeholder="Any additional observations from the site visit..." />
                    </CardContent>
                </Card>

                <Button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700 py-5 text-base font-bold shadow-lg">
                    {loading ? "Submitting..." : "🚀 Submit to Verification Queue"}
                </Button>
            </form>
        </div>
    );
}
