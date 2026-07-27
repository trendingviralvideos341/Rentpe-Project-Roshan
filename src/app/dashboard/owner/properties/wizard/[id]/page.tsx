'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  MapPin, Building2, Sparkles, BedDouble, Camera, CheckCircle2,
  ArrowLeft, ArrowRight, Save, Loader2, AlertCircle, Plus, X,
  Home, Star, Wifi, Car, Shield, Utensils, Dumbbell, Zap,
  ChevronRight, Clock, FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  getDraftProperty,
  saveWizardStep1, saveWizardStep2, saveWizardStep3,
  saveWizardStep4, saveWizardStep5, submitDraftForReview,
} from '@/actions/properties-v2';
import { getCloudinarySignature } from '@/actions/uploads';
import { compressImage } from '@/lib/imageCompression';

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Location',   icon: MapPin },
  { id: 2, label: 'Identity',   icon: Building2 },
  { id: 3, label: 'Amenities',  icon: Sparkles },
  { id: 4, label: 'Rooms',      icon: BedDouble },
  { id: 5, label: 'Photos',     icon: Camera },
  { id: 6, label: 'Submit',     icon: CheckCircle2 },
];

const AMENITY_OPTIONS = [
  { label: 'WiFi', icon: Wifi },
  { label: 'AC', icon: Zap },
  { label: 'Parking', icon: Car },
  { label: 'Security', icon: Shield },
  { label: 'Food/Mess', icon: Utensils },
  { label: 'Gym', icon: Dumbbell },
  { label: 'Laundry', icon: Star },
  { label: 'CCTV', icon: Shield },
  { label: 'Power Backup', icon: Zap },
  { label: 'Hot Water', icon: Star },
  { label: 'Lift/Elevator', icon: Home },
  { label: 'Study Room', icon: Star },
  { label: 'Attached Bathroom', icon: Home },
  { label: 'Biometric Entry', icon: Shield },
  { label: 'Cleaning Service', icon: Sparkles },
];

type DocEntry = { file: File; previewUrl: string; cloudUrl: string | null; uploading: boolean };

// ─── Main Wizard Page ─────────────────────────────────────────────────────────

export default function PropertyWizardPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<any>(null);
  const [completeness, setCompleteness] = useState(0);

  // Step 1: Location
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Step 2: Identity
  const [propName, setPropName] = useState('');
  const [propertyType, setPropertyType] = useState(''); // Default to empty
  const [genderType, setGenderType] = useState('COED');
  const [businessName, setBusinessName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  // Step 3: Amenities
  const [amenities, setAmenities] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [foodType, setFoodType] = useState('NOT_AVAILABLE');
  const [foodPrice, setFoodPrice] = useState('');
  const [rules, setRules] = useState('');

  // Step 4: Rooms
  const [rooms, setRooms] = useState<Array<{
    roomNumber: string; type: string; price: string; availability: string; securityDeposit: string;
  }>>([]);

  // Step 5: Photos
  const [buildingPhotos, setBuildingPhotos] = useState<DocEntry[]>([]);
  const [roomPhotos, setRoomPhotos] = useState<DocEntry[]>([]);
  const [signatureCache, setSignatureCache] = useState<{ data: any; expiry: number } | null>(null);

  // ── Load draft on mount ──
  useEffect(() => {
    const load = async () => {
      const res = await getDraftProperty(propertyId);
      if ('error' in res || !res.success) {
        toast.error('Draft not found.');
        router.push('/dashboard/owner/properties');
        return;
      }
      const p = res.property;
      setProperty(p);
      setCompleteness((p as any).completenessScore || 0);

      // Prefill from saved data
      setAddress(p.address || '');
      setCity(p.city || '');
      setPropName(p.name === 'Untitled Property (Draft)' ? '' : p.name || '');
      setPropertyType(p.propertyType || '');
      setGenderType(p.genderType || 'COED');
      setBusinessName((p as any).businessName || '');
      setLicenseNumber((p as any).licenseNumber || '');
      setGstNumber((p as any).gstNumber || '');
      setDescription(p.description || '');
      setFoodType((p as any).foodType || 'NOT_AVAILABLE');
      setRules((p as any).rules || '');
      try { setAmenities(JSON.parse(p.amenities || '[]')); } catch {}
      if (p.rooms?.length) {
        setRooms(p.rooms.map((r: any) => ({
          roomNumber: r.roomNumber,
          type: r.type,
          price: String(r.price),
          availability: String(r.availability),
          securityDeposit: String(r.depositMonths || 1),
        })));
      }
      setLoading(false);
    };
    load();

    // Pre-warm Cloudinary signature
    const warmup = async () => {
      try {
        const ts = Math.floor(Date.now() / 1000);
        const data = await getCloudinarySignature({ folder: `rentpe/properties/temp`, timestamp: ts });
        setSignatureCache({ data, expiry: Date.now() + 45 * 60 * 1000 });
      } catch {}
    };
    warmup();
  }, [propertyId, router]);

  // ── Pincode auto-fetch ──
  useEffect(() => {
    if (pincode.length !== 6) return;
    setPinLoading(true);
    fetch(`https://api.postalpincode.in/pincode/${pincode}`)
      .then(r => r.json())
      .then(data => {
        if (data?.[0]?.Status === 'Success') {
          const office = data[0].PostOffice?.[0];
          if (office) setCity(office.District);
        }
      })
      .catch(() => {})
      .finally(() => setPinLoading(false));
  }, [pincode]);

  // ── Photo Upload ──
  const uploadPhoto = useCallback(async (file: File): Promise<string | null> => {
    try {
      const now = Date.now();
      let sigData = signatureCache && signatureCache.expiry > now ? signatureCache.data : null;
      if (!sigData) {
        sigData = await getCloudinarySignature({ folder: `rentpe/properties/${propertyId}`, timestamp: Math.floor(now / 1000) });
        setSignatureCache({ data: sigData, expiry: now + 45 * 60 * 1000 });
      }
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed);
      formData.append('api_key', sigData.apiKey);
      formData.append('timestamp', sigData.timestamp);
      formData.append('signature', sigData.signature);
      formData.append('folder', sigData.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`, {
        method: 'POST', body: formData
      });
      const json = await res.json();
      return json.secure_url || null;
    } catch { return null; }
  }, [signatureCache, propertyId]);

  const handlePhotoAdd = useCallback(async (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<DocEntry[]>>
  ) => {
    if (!files) return;
    const fileArr = Array.from(files);
    const newEntries: DocEntry[] = fileArr.map(f => ({
      file: f, previewUrl: URL.createObjectURL(f), cloudUrl: null, uploading: true,
    }));
    setter(prev => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      const url = await uploadPhoto(entry.file);
      setter(prev => prev.map(e =>
        e.previewUrl === entry.previewUrl ? { ...e, cloudUrl: url, uploading: false } : e
      ));
    }
  }, [uploadPhoto]);

  // ── Save & Navigate ──
  const saveStep = async (step: number): Promise<boolean> => {
    setSaving(true);
    try {
      let res: any;
      if (step === 1) {
        if (!address.trim() || !city.trim()) { toast.error('Address and City are required.'); return false; }
        res = await saveWizardStep1(propertyId, { address, city, pincode });
      } else if (step === 2) {
        if (!propName.trim()) { toast.error('Property name is required.'); return false; }
        res = await saveWizardStep2(propertyId, { name: propName, propertyType: propertyType as any, genderType: genderType as any, businessName, licenseNumber, gstNumber });
      } else if (step === 3) {
        res = await saveWizardStep3(propertyId, { amenities: JSON.stringify(amenities), description, foodType, foodPricePerMonth: foodPrice ? parseFloat(foodPrice) : undefined, rules });
      } else if (step === 4) {
        if (rooms.length === 0) { toast.error('Add at least one room.'); return false; }
        const roomData = rooms.map(r => ({ roomNumber: r.roomNumber, type: r.type, price: parseFloat(r.price) || 0, availability: parseInt(r.availability) || 1, securityDeposit: parseInt(r.securityDeposit) || 1 }));
        res = await saveWizardStep4(propertyId, roomData);
      } else if (step === 5) {
        const bUrls = buildingPhotos.filter(p => p.cloudUrl).map(p => p.cloudUrl!);
        const rUrls = roomPhotos.filter(p => p.cloudUrl).map(p => p.cloudUrl!);
        res = await saveWizardStep5(propertyId, { buildingPhotos: bUrls, roomsAndBathroomPhotos: rUrls });
      }
      if (res?.error) { toast.error(res.error); return false; }
      setCompleteness(prev => Math.min(100, prev + 15));
      toast.success('Saved!', { duration: 1200 });
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Save failed.');
      return false;
    } finally { setSaving(false); }
  };

  const handleNext = async () => {
    if (currentStep < 6) {
      const ok = await saveStep(currentStep);
      if (ok) { setCurrentStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
  };

  const handleBack = () => {
    setCurrentStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalSubmit = async () => {
    setSaving(true);
    const res = await submitDraftForReview(propertyId);
    setSaving(false);
    if (res?.error) { toast.error(res.error); return; }
    toast.success('🎉 Property submitted for review!');
    router.push('/dashboard/owner/properties');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-500">Loading your draft...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/30">
      {/* ── Header ── */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-violet-100/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <button onClick={() => router.push('/dashboard/owner/properties')}
              className="flex items-center gap-2 text-slate-500 hover:text-violet-700 font-bold text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="flex-1 text-center">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Property Wizard</p>
              <p className="text-sm font-black text-slate-700 truncate">
                {propName || property?.displayId || 'New Property'}
              </p>
            </div>

            {/* Auto-save indicator */}
            <div className="flex items-center gap-1.5 text-emerald-600">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Auto-save</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isDone = currentStep > step.id;
              const isActive = currentStep === step.id;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => isDone && setCurrentStep(step.id)}
                    className={`flex flex-col items-center gap-1 flex-1 transition-all ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all font-black text-xs
                      ${isDone ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                        isActive ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200 scale-110' :
                        'bg-slate-100 text-slate-400'}`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-tight hidden sm:block
                      ${isActive ? 'text-violet-700' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all
                      ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Completeness */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${completeness}%` }} />
            </div>
            <span className="text-[10px] font-black text-violet-600 min-w-[32px] text-right">{completeness}%</span>
          </div>
        </div>
      </div>

      {/* ── Step Content ── */}
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* STEP 1 — Location */}
        {currentStep === 1 && (
          <StepShell title="📍 Where is your property?" subtitle="Enter the full address. Tenants use this to find you.">
            <div className="space-y-4">
              <div>
                <label className="label-style">Full Street Address *</label>
                <Input value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. 42 MG Road, Near City Mall"
                  className="input-style mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-style">PIN Code</label>
                  <div className="relative mt-1">
                    <Input value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/, '').slice(0, 6))}
                      placeholder="6-digit PIN" className="input-style pr-8" maxLength={6} />
                    {pinLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-violet-500" />}
                  </div>
                </div>
                <div>
                  <label className="label-style">City *</label>
                  <Input value={city} onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Bangalore" className="input-style mt-1" />
                </div>
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm text-violet-700 font-medium flex gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-violet-500" />
                Your address is only shown to verified tenants. It is never publicly indexed.
              </div>
            </div>
          </StepShell>
        )}

        {/* STEP 2 — Property Identity */}
        {currentStep === 2 && (
          <StepShell title="🏢 Tell us about your property" subtitle="Name, type, and legal details.">
            <div className="space-y-5">
              
              <div>
                <label className="label-style">Select Property Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {['PG', 'HOSTEL', 'FLAT', 'ROOM'].map(t => (
                    <button key={t} type="button" onClick={() => setPropertyType(t)}
                      className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${propertyType === t ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-md' : 'border-slate-200 text-slate-500 hover:border-violet-300 bg-white'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                {!propertyType && <p className="text-xs text-amber-600 font-bold mt-2 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> Please select a property type to unlock the rest of the form.</p>}
              </div>

              <div className={`transition-all duration-500 ${!propertyType ? 'opacity-40 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                <div className="space-y-5">
                  <div>
                    <label className="label-style">Property Name <span className="text-red-500">*</span></label>
                    <Input value={propName} 
                      onChange={e => setPropName(e.target.value.replace(/[^a-zA-Z0-9\s\-_']/g, ''))}
                      placeholder="e.g. Green Valley PG for Girls" className="input-style mt-1" disabled={!propertyType} />
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Letters, numbers, spaces, and hyphens only.</p>
                  </div>

                  <div>
                    <label className="label-style">Gender Preference <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[['COED', '👫 Co-ed'], ['MALE', '👨 Boys'], ['FEMALE', '👩 Girls']].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setGenderType(v)} disabled={!propertyType}
                          className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${genderType === v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300 bg-white'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-style">Business / Trade Name <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <Input value={businessName} 
                        onChange={e => setBusinessName(e.target.value.replace(/[^a-zA-Z0-9\s\-_\.,&()]/g, ''))}
                        placeholder="e.g. ABC Hostel Pvt. Ltd." className="input-style mt-1" disabled={!propertyType} />
                    </div>
                    <div>
                      <label className="label-style">Licence No. / RERA ID <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <Input value={licenseNumber} 
                        onChange={e => setLicenseNumber(e.target.value.replace(/[^a-zA-Z0-9\-_/]/g, ''))}
                        placeholder="e.g. PG/2024/BLR-001" className="input-style mt-1" disabled={!propertyType} />
                    </div>
                  </div>

                  <div>
                    <label className="label-style">GST Number <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <Input value={gstNumber} 
                      onChange={e => setGstNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                      placeholder="e.g. 29AAAAA1111A1Z1" maxLength={15} className="input-style mt-1 font-mono" disabled={!propertyType} />
                  </div>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* STEP 3 — Amenities */}
        {currentStep === 3 && (
          <StepShell title="✨ What do you offer?" subtitle="Select amenities and describe your PG.">
            <div className="space-y-6">
              <div>
                <label className="label-style mb-2 block">Amenities</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {AMENITY_OPTIONS.map(({ label }) => {
                    const active = amenities.includes(label);
                    return (
                      <button key={label} type="button" onClick={() => setAmenities(prev => active ? prev.filter(a => a !== label) : [...prev, label])}
                        className={`p-2.5 rounded-xl border-2 text-[11px] font-black transition-all text-center
                          ${active ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-violet-200'}`}>
                        {active && '✓ '}{label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label-style">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe your PG — location advantages, cleanliness, security, food quality, nearby facilities..."
                  rows={4} className="w-full mt-1 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none resize-none font-medium transition-colors" />
              </div>

              <div>
                <label className="label-style">House Rules <span className="text-slate-400 font-normal">(Optional)</span></label>
                <textarea value={rules} onChange={e => setRules(e.target.value)}
                  placeholder="e.g. No alcohol, No smoking, Guests until 9pm only..."
                  rows={2} className="w-full mt-1 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none resize-none font-medium transition-colors" />
              </div>

              <div>
                <label className="label-style">Food / Mess Service</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[['NOT_AVAILABLE', '🚫 Not Available'], ['INCLUDED', '✅ Included in Rent'], ['OPTIONAL', '➕ Optional Add-on']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setFoodType(v)}
                      className={`p-3 rounded-xl border-2 text-[11px] font-black transition-all ${foodType === v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {foodType === 'OPTIONAL' && (
                  <div className="mt-3">
                    <label className="label-style">Food Price per Month (₹)</label>
                    <Input value={foodPrice} onChange={e => setFoodPrice(e.target.value)} type="number"
                      placeholder="e.g. 2500" className="input-style mt-1" />
                  </div>
                )}
              </div>
            </div>
          </StepShell>
        )}

        {/* STEP 4 — Rooms */}
        {currentStep === 4 && (
          <StepShell title="🛏️ Set up your rooms" subtitle="Add the room types and pricing.">
            <div className="space-y-4">
              {rooms.map((room, i) => (
                <div key={i} className="border-2 border-slate-200 rounded-2xl p-4 space-y-3 hover:border-violet-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-700 text-sm">Room {i + 1}</span>
                    <button type="button" onClick={() => setRooms(rooms.filter((_, idx) => idx !== i))}
                      className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors">
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-style text-[11px]">Room Number/Name *</label>
                      <Input value={room.roomNumber} onChange={e => {
                        const u = [...rooms]; u[i].roomNumber = e.target.value.replace(/[^a-zA-Z0-9\-_]/g, ''); setRooms(u);
                      }} placeholder="e.g. A1 or 101" className="input-style mt-1 text-sm" />
                    </div>
                    <div>
                      <label className="label-style text-[11px]">Type</label>
                      <select value={room.type} onChange={e => {
                        const u = [...rooms]; u[i].type = e.target.value; setRooms(u);
                      }} className="w-full mt-1 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none font-medium bg-white">
                        {['Single Sharing', 'Double Sharing', 'Triple Sharing', '4-Sharing', 'Private Room'].map(t => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-style text-[11px]">Rent per Bed (₹/month) *</label>
                      <Input value={room.price} onChange={e => {
                        const u = [...rooms]; u[i].price = e.target.value; setRooms(u);
                      }} type="number" placeholder="e.g. 8000" className="input-style mt-1 text-sm" />
                    </div>
                    <div>
                      <label className="label-style text-[11px]">No. of Beds *</label>
                      <Input value={room.availability} onChange={e => {
                        const u = [...rooms]; u[i].availability = e.target.value; setRooms(u);
                      }} type="number" min="1" max="20" placeholder="e.g. 2" className="input-style mt-1 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="label-style text-[11px]">Security Deposit</label>
                      <div className="flex gap-2 mt-1">
                        {['1', '2'].map(m => (
                          <button key={m} type="button" onClick={() => {
                            const u = [...rooms]; u[i].securityDeposit = m; setRooms(u);
                          }} className={`flex-1 py-2 rounded-xl border-2 text-sm font-black transition-all
                            ${room.securityDeposit === m ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500'}`}>
                            {m} Month{m === '2' ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setRooms([...rooms, { roomNumber: '', type: 'Double Sharing', price: '', availability: '2', securityDeposit: '1' }])}
                className="w-full border-2 border-dashed border-violet-300 rounded-2xl p-4 text-sm font-black text-violet-600 hover:bg-violet-50 flex items-center justify-center gap-2 transition-all">
                <Plus className="h-4 w-4" /> Add Another Room
              </button>

              {rooms.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <BedDouble className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="font-bold text-sm">No rooms yet. Add your first room above.</p>
                </div>
              )}
            </div>
          </StepShell>
        )}

        {/* STEP 5 — Photos */}
        {currentStep === 5 && (
          <StepShell title="📸 Showcase your property" subtitle="Great photos get 3x more inquiries. Add at least 3.">
            <div className="space-y-6">
              <PhotoUploadSection
                label="Building & Exterior Photos"
                photos={buildingPhotos}
                onAdd={(files) => handlePhotoAdd(files, setBuildingPhotos)}
                onRemove={(i) => setBuildingPhotos(prev => prev.filter((_, idx) => idx !== i))}
                required
              />
              <PhotoUploadSection
                label="Rooms & Bathrooms"
                photos={roomPhotos}
                onAdd={(files) => handlePhotoAdd(files, setRoomPhotos)}
                onRemove={(i) => setRoomPhotos(prev => prev.filter((_, idx) => idx !== i))}
              />
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-sm text-amber-700 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                Photos are reviewed by our team. Misleading images may result in listing removal.
              </div>
            </div>
          </StepShell>
        )}

        {/* STEP 6 — Review & Submit */}
        {currentStep === 6 && (
          <StepShell title="🎉 Ready to submit!" subtitle="Review your property details before going live.">
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SummaryItem icon={MapPin} label="Address" value={`${address}, ${city}`} />
                <SummaryItem icon={Building2} label="Property" value={`${propName} (${propertyType})`} />
                <SummaryItem icon={BedDouble} label="Rooms" value={`${rooms.length} room type(s) configured`} />
                <SummaryItem icon={Sparkles} label="Amenities" value={amenities.length > 0 ? amenities.slice(0, 3).join(', ') + (amenities.length > 3 ? '...' : '') : 'None selected'} />
                <SummaryItem icon={Camera} label="Photos" value={`${buildingPhotos.length + roomPhotos.length} photos uploaded`} />
                <SummaryItem icon={Star} label="Completeness" value={`${completeness}% complete`} />
              </div>

              {/* Checklist */}
              <div className="border-2 border-violet-100 rounded-2xl p-4 space-y-2 bg-violet-50/50">
                <p className="font-black text-sm text-violet-900 mb-3">What happens next?</p>
                {[
                  'Our team reviews your listing (1-3 business days)',
                  'You may be asked to upload KYC documents',
                  'Once verified, you complete the platform agreement',
                  'Your property goes LIVE and tenants can book',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-violet-700">
                    <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-violet-400" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="border-2 border-emerald-100 rounded-2xl p-4 bg-emerald-50/50 flex gap-3">
                <FileCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-sm text-emerald-800">Platform Agreement</p>
                  <p className="text-xs text-emerald-600 mt-0.5">By submitting, you confirm all information is accurate and agree to RentPe's Owner Terms of Service.</p>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* ── Navigation Buttons ── */}
        <div className="flex gap-3 mt-6">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack}
              className="flex-1 border-2 border-slate-200 font-black h-12 rounded-2xl hover:border-violet-300">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          )}

          {currentStep < 6 ? (
            <Button onClick={handleNext} disabled={saving}
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black h-12 rounded-2xl shadow-lg shadow-violet-200 transition-all">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Saving...' : 'Save & Continue'}
              {!saving && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          ) : (
            <Button onClick={handleFinalSubmit} disabled={saving}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black h-12 rounded-2xl shadow-lg shadow-emerald-200 transition-all">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {saving ? 'Submitting...' : 'Submit for Review'}
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-3 font-medium flex items-center justify-center gap-1">
          <Clock className="h-3 w-3" /> Your progress is automatically saved. You can leave and return anytime.
        </p>
      </div>
    </div>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="border-none shadow-xl shadow-violet-100/40 rounded-3xl overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-6 py-5">
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="text-violet-200 text-sm mt-1 font-medium">{subtitle}</p>
      </div>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function PhotoUploadSection({
  label, photos, onAdd, onRemove, required = false,
}: {
  label: string;
  photos: DocEntry[];
  onAdd: (files: FileList | null) => void;
  onRemove: (i: number) => void;
  required?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label-style">{label}</label>
        {required && <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md">Required</span>}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((photo, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-violet-200 group">
            <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
            {photo.uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-violet-600 animate-spin" />
              </div>
            )}
            {photo.cloudUrl && !photo.uploading && (
              <div className="absolute bottom-1 right-1 bg-emerald-500 text-white text-[8px] px-1 rounded font-mono">✓</div>
            )}
            <button type="button" onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50 flex flex-col items-center justify-center cursor-pointer transition-all">
          <Plus className="h-5 w-5 text-slate-400" />
          <span className="text-[9px] font-black text-slate-400 mt-1">ADD</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => onAdd(e.target.files)} />
        </label>
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-violet-600" />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-700 mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}
