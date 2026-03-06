"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { submitReview } from "@/actions/reviews";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface SubmitReviewModalProps {
    booking: any;
    isOpen: boolean;
    onClose: () => void;
}

export function SubmitReviewModal({ booking, isOpen, onClose }: SubmitReviewModalProps) {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // To leave a review, we must find the active Tenant ID associated with this booking's room.
    // For simplicity, we pass the booking's assigned Room/Property down.

    // In our simplified workflow, we extract the tenantId if it exists on the property tree.
    // The backend uses the room/bookings logic to verify.
    // If we dont have exactly 1 tenant record available on the client, we mock the call for now and
    // let backend fail securely if illegal.

    // As a hack to pass tenantId from the booking tree, we assume the user has 1 tenant record here:
    // (In production, the API should return the explicit tenantId inside the booking payload)

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Please select a star rating first.");
            return;
        }

        const tenantId = booking.tenantId;
        if (!tenantId) {
            toast.error("Reviewing is only available for confirmed residents with an active tenancy.");
            return;
        }

        setIsSubmitting(true);
        try {
            await submitReview(booking.propertyId, tenantId, rating, comment);
            toast.success("Review submitted successfully! Thank you for your feedback.");
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Failed to submit review.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Rate Your Stay</DialogTitle>
                    <DialogDescription>
                        Share your experience at {booking.propertyName} to help future tenants make informed decisions.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center gap-4">
                    <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className="focus:outline-none transition-transform hover:scale-110"
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                            >
                                <Star
                                    className={`h-10 w-10 ${star <= (hoverRating || rating)
                                        ? "fill-yellow-400 text-yellow-500"
                                        : "fill-transparent text-gray-300"
                                        }`}
                                />
                            </button>
                        ))}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                        {rating === 0 ? "Select a rating" :
                            rating === 1 ? "Terrible" :
                                rating === 2 ? "Bad" :
                                    rating === 3 ? "Okay" :
                                        rating === 4 ? "Good" : "Excellent!"}
                    </div>

                    <div className="w-full mt-4">
                        <label className="text-xs font-bold text-gray-700 mb-1 block">Write a Review (Optional)</label>
                        <Textarea
                            placeholder="What did you like or dislike about this PG?"
                            className="resize-none"
                            rows={4}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0} className="bg-blue-600 hover:bg-blue-700">
                        {isSubmitting ? "Submitting..." : "Submit Review"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
