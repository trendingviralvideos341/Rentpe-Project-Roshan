"use client";

import { useState } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitBankDetails } from "@/actions/properties";
import { Loader2, UploadCloud, Landmark, FileCheck } from "lucide-react";
import { useResumableUpload } from "@/hooks/useResumableUpload";
import { toast } from "sonner";

interface BankDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    propertyId: string;
    propertyName: string;
    onSuccess: () => void;
}

export function BankDetailsModal({ isOpen, onClose, propertyId, propertyName, onSuccess }: BankDetailsModalProps) {
    const [bankAccountNo, setBankAccountNo] = useState("");
    const [bankIfsc, setBankIfsc] = useState("");
    const [bankName, setBankName] = useState("");
    const [cancelChequeUrl, setCancelChequeUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const uploader = useResumableUpload();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await uploader.uploadFile(file);
            setCancelChequeUrl(result.url);
            toast.success("Cheque uploaded successfully!");
        } catch (error: any) {
            toast.error("Failed to upload cheque: " + error.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!bankAccountNo || !bankIfsc || !bankName || !cancelChequeUrl) {
            toast.error("Please fill all fields and upload a cancelled cheque/passbook.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await submitBankDetails(propertyId, {
                bankAccountNo,
                bankIfsc,
                bankName,
                cancelChequeUrl
            });

            if (res.success) {
                toast.success("Bank details submitted successfully!");
                onSuccess();
                onClose();
            } else {
                toast.error("Failed to submit bank details.");
            }
        } catch (error: any) {
            toast.error(error.message || "An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl border-2 border-slate-950 p-0 overflow-hidden">
                <div className="bg-indigo-600 p-6 text-white text-center">
                    <Landmark className="h-10 w-10 mx-auto mb-2 text-indigo-200" />
                    <DialogTitle className="text-2xl font-black">Bank Details Required</DialogTitle>
                    <DialogDescription className="text-indigo-100 font-bold mt-1">
                        For payout setup of "{propertyName}"
                    </DialogDescription>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-50">
                    <div className="space-y-1">
                        <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">Beneficiary Name (As per Bank)</Label>
                        <Input 
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="h-11 border-2 border-slate-200 focus-visible:ring-indigo-500 rounded-xl font-bold" 
                            placeholder="e.g. John Doe"
                            required
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">Account Number</Label>
                        <Input 
                            value={bankAccountNo}
                            onChange={(e) => setBankAccountNo(e.target.value)}
                            className="h-11 border-2 border-slate-200 focus-visible:ring-indigo-500 rounded-xl font-bold font-mono" 
                            placeholder="Enter account number"
                            type="password"
                            required
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">IFSC Code</Label>
                        <Input 
                            value={bankIfsc}
                            onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                            className="h-11 border-2 border-slate-200 focus-visible:ring-indigo-500 rounded-xl font-bold font-mono uppercase" 
                            placeholder="e.g. HDFC0001234"
                            maxLength={11}
                            required
                        />
                    </div>

                    <div className="space-y-1 pt-2">
                        <Label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center justify-between">
                            Upload Cancelled Cheque / Passbook
                            {cancelChequeUrl && <span className="text-emerald-600 flex items-center gap-1"><FileCheck className="h-3 w-3"/> Uploaded</span>}
                        </Label>
                        
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl bg-white hover:bg-slate-50 transition-colors relative">
                            <div className="space-y-1 text-center">
                                {uploader.status === 'UPLOADING' ? (
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-2" />
                                        <span className="text-xs font-bold text-slate-500">Uploading {Math.round(uploader.progress.percent)}%</span>
                                    </div>
                                ) : cancelChequeUrl ? (
                                    <div className="flex flex-col items-center">
                                        <FileCheck className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                                        <div className="text-sm text-slate-600 font-bold">Image Saved</div>
                                        <label className="text-xs text-indigo-600 font-bold cursor-pointer hover:underline mt-1">
                                            Replace file
                                            <input type="file" className="sr-only" accept="image/*" onChange={handleFileSelect} />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                                        <div className="flex text-sm text-slate-600">
                                            <label className="relative cursor-pointer rounded-md font-bold text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                                <span>Upload a file</span>
                                                <input type="file" className="sr-only" accept="image/*" onChange={handleFileSelect} />
                                            </label>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={onClose}
                            className="flex-1 rounded-xl h-11 border-2 border-slate-200 font-bold"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="flex-1 rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            disabled={isSubmitting || !cancelChequeUrl || uploader.status === 'UPLOADING'}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                            ) : (
                                "Submit Details"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
