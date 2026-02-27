"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface PincodeAddressProps {
    label: string;
    required?: boolean;
    value: string;
    onChange: (full: string) => void;
    error?: string;
    hint?: string;
    /** If provided, shows a "Same as Permanent" checkbox and auto-fills from this value */
    copyFromValue?: string;
}

interface PostOffice {
    Name: string;
    District: string;
    State: string;
    Block: string;
    Country: string;
}

/**
 * Industry-standard address input with India PIN code auto-fetch.
 * - House/Flat: must start with a digit or "#" (e.g. 12-B, #401, Flat 3A)
 * - Street/Area: letters, numbers, commas, hyphens
 * - PIN Code: exactly 6 digits, auto-fetches city/state/district from India Post API
 */
export default function PincodeAddress({ label, required, value, onChange, error, hint, copyFromValue }: PincodeAddressProps) {
    const [house, setHouse] = useState("");
    const [street, setStreet] = useState("");
    const [pincode, setPincode] = useState("");
    const [city, setCity] = useState("");
    const [district, setDistrict] = useState("");
    const [state, setState] = useState("");
    const [postOffice, setPostOffice] = useState("");

    const [houseError, setHouseError] = useState("");
    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState("");
    const [postOffices, setPostOffices] = useState<PostOffice[]>([]);
    const [initialized, setInitialized] = useState(false);
    const [sameAsPermanent, setSameAsPermanent] = useState(false);

    // Parse existing value on first render
    useEffect(() => {
        if (initialized || !value) return;
        const m = value.match(/^(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?)\s*-\s*(\d{6})$/);
        if (m) {
            setHouse(m[1]); setStreet(m[2]); setPostOffice(m[3]); setDistrict(m[4]); setCity(m[5]); setState(m[6]); setPincode(m[7]);
        } else {
            setHouse(value);
        }
        setInitialized(true);
    }, [value, initialized]);

    // Compose the full address string
    function compose(h: string, s: string, po: string, dist: string, c: string, st: string, pin: string) {
        const parts = [h, s, po, dist, c, st].filter(Boolean);
        const full = parts.join(", ") + (pin ? ` - ${pin}` : "");
        onChange(full);
    }

    // Validate house/flat number: must start with a digit or #, can contain letters/numbers/hyphens/slashes/spaces
    function validateHouse(v: string): string {
        if (!v.trim()) return required ? "House / Flat No is required" : "";
        if (!/^[#\d]/.test(v.trim())) return "Must start with a number or # (e.g. 12-B, #401)";
        if (!/^[A-Za-z0-9#\-\/\s,.]+$/.test(v.trim())) return "Only letters, numbers, #, -, / allowed";
        return "";
    }

    function update(field: string, val: string) {
        let h = house, s = street, po = postOffice, d = district, c = city, st = state, p = pincode;
        switch (field) {
            case "house":
                h = val; setHouse(val);
                setHouseError(validateHouse(val));
                break;
            case "street": s = val; setStreet(val); break;
            case "postOffice": po = val; setPostOffice(val); break;
            case "district": d = val; setDistrict(val); break;
            case "city": c = val; setCity(val); break;
            case "state": st = val; setState(val); break;
            case "pincode": p = val; setPincode(val); break;
        }
        compose(h, s, po, d, c, st, p);
    }

    // "Same as Permanent" toggle
    function handleSameAsPermanent(checked: boolean) {
        setSameAsPermanent(checked);
        if (checked && copyFromValue) {
            onChange(copyFromValue);
            // Parse copyFromValue into sub-fields
            const m = copyFromValue.match(/^(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?)\s*-\s*(\d{6})$/);
            if (m) {
                setHouse(m[1]); setStreet(m[2]); setPostOffice(m[3]); setDistrict(m[4]); setCity(m[5]); setState(m[6]); setPincode(m[7]);
            }
        }
    }

    // Auto-fetch when pincode reaches 6 digits
    useEffect(() => {
        if (sameAsPermanent) return;
        if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
            setPostOffices([]);
            setFetchError("");
            return;
        }

        let cancelled = false;
        setFetching(true);
        setFetchError("");

        fetch(`https://api.postalpincode.in/pincode/${pincode}`)
            .then(r => r.json())
            .then((data) => {
                if (cancelled) return;
                if (!data || !data[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) {
                    setFetchError("Invalid PIN code – no results found");
                    setCity(""); setDistrict(""); setState(""); setPostOffice(""); setPostOffices([]);
                    compose(house, street, "", "", "", "", pincode);
                    return;
                }

                const offices: PostOffice[] = data[0].PostOffice;
                setPostOffices(offices);

                const first = offices[0];
                setCity(first.District);
                setDistrict(first.District);
                setState(first.State);
                setPostOffice(first.Name);

                compose(house, street, first.Name, first.District, first.District, first.State, pincode);
            })
            .catch(() => {
                if (!cancelled) setFetchError("Failed to fetch PIN data – check your internet");
            })
            .finally(() => { if (!cancelled) setFetching(false); });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pincode, sameAsPermanent]);

    const inputCls = "h-9 text-sm";
    const readOnlyCls = "h-9 text-sm bg-gray-50 cursor-not-allowed";
    const disabled = sameAsPermanent;

    return (
        <div className="col-span-3 space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{label} {required && "*"}</label>
                {copyFromValue !== undefined && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input type="checkbox" checked={sameAsPermanent}
                            onChange={e => handleSameAsPermanent(e.target.checked)}
                            className="accent-primary w-3.5 h-3.5" />
                        <span className="text-muted-foreground font-medium">Same as Permanent Address</span>
                    </label>
                )}
            </div>

            {sameAsPermanent ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                    ✅ Same as Permanent Address
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-6 gap-3">
                        {/* Row 1: House, Street, Pincode */}
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">House / Flat No *</label>
                            <Input className={`${inputCls} ${houseError ? "border-red-400" : ""}`}
                                placeholder="e.g. 12-B, #401, Flat 3A"
                                value={house} onChange={e => update("house", e.target.value)} disabled={disabled} />
                            {houseError && <p className="text-[10px] text-red-500">{houseError}</p>}
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Street / Locality</label>
                            <Input className={inputCls} placeholder="e.g. MG Road, Koramangala"
                                value={street} onChange={e => update("street", e.target.value)} disabled={disabled} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">
                                PIN Code * {fetching && <span className="text-blue-500 animate-pulse">⏳ Fetching…</span>}
                            </label>
                            <Input className={`${inputCls} font-mono tracking-wider ${fetchError ? "border-red-400" : ""}`}
                                placeholder="e.g. 560001" maxLength={6}
                                value={pincode} onChange={e => {
                                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                                    setPincode(v);
                                    update("pincode", v);
                                }} disabled={disabled} />
                            {fetchError && <p className="text-[10px] text-red-500">{fetchError}</p>}
                        </div>

                        {/* Row 2: Post Office, District, City, State */}
                        {postOffices.length > 1 ? (
                            <div className="col-span-2 space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">Post Office</label>
                                <select value={postOffice}
                                    onChange={e => { setPostOffice(e.target.value); update("postOffice", e.target.value); }}
                                    className="w-full h-9 border rounded-md px-3 py-1 text-sm border-input bg-blue-50" disabled={disabled}>
                                    {postOffices.map(po => (
                                        <option key={po.Name} value={po.Name}>{po.Name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="col-span-2 space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">Post Office</label>
                                <Input className={readOnlyCls} readOnly value={postOffice} placeholder="Auto-filled from PIN" />
                            </div>
                        )}
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">District</label>
                            <Input className={readOnlyCls} readOnly value={district} placeholder="Auto" />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">City</label>
                            <Input className={readOnlyCls} readOnly value={city} placeholder="Auto" />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">State</label>
                            <Input className={readOnlyCls} readOnly value={state} placeholder="Auto-filled from PIN" />
                        </div>
                    </div>
                    {city && state && pincode.length === 6 && (
                        <p className="text-[10px] text-green-600 font-medium">
                            ✅ {postOffice}, {district}, {city}, {state} - {pincode}
                        </p>
                    )}
                </>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            {hint && !error && !sameAsPermanent && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
    );
}
