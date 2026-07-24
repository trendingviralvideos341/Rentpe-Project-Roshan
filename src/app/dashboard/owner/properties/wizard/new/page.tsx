'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, ArrowRight, Building2, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createDraftProperty } from '@/actions/properties-v2';
import { toast } from 'sonner';

/**
 * Wizard Entry Page — /dashboard/owner/properties/wizard/new
 * ──────────────────────────────────────────────────────────
 * This page creates an instant draft property (reserves the RP-P-XXXXXXXXXX ID)
 * then immediately redirects to the step-by-step wizard.
 * If a draft already exists, it resumes that draft instead.
 */
export default function WizardNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await createDraftProperty();
      if (res.error) {
        toast.error(res.error);
        setLoading(false);
        return;
      }
      if (res.isExistingDraft) {
        toast.info('Resuming your existing draft...');
      } else {
        toast.success(`Property ID reserved: ${(res.property as any).displayId}`);
      }
      setStarted(true);
      router.push(`/dashboard/owner/properties/wizard/${res.property?.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to start wizard.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl shadow-2xl shadow-violet-300 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">List Your Property</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Complete our 6-step guided wizard. Your progress is saved automatically — come back anytime.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 text-left">
          {[
            { icon: Sparkles, label: 'Smart Wizard', sub: '6 steps, auto-saves' },
            { icon: Clock, label: 'Save & Resume', sub: 'No data loss ever' },
            { icon: Shield, label: 'Secure Upload', sub: 'Encrypted storage' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-white rounded-2xl p-3 border border-violet-100 shadow-sm">
              <Icon className="h-5 w-5 text-violet-600 mb-1" />
              <p className="text-xs font-black text-slate-800">{label}</p>
              <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
            </div>
          ))}
        </div>

        <Button
          onClick={handleStart}
          disabled={loading || started}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black h-14 rounded-2xl text-base shadow-xl shadow-violet-300/50 transition-all hover:scale-[1.02]"
        >
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Reserving your Property ID...</>
          ) : (
            <><Sparkles className="h-5 w-5 mr-2" /> Start the Wizard <ArrowRight className="h-5 w-5 ml-2" /></>
          )}
        </Button>

        <p className="text-xs text-slate-400 font-medium">
          Your unique property ID (e.g. RP-P-0000000001) is reserved the moment you click Start.
        </p>
      </div>
    </div>
  );
}
