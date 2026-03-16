import { toast } from "sonner";

export function useToast() {
    return {
        toast: ({ title, description, variant }: { title?: string, description?: string, variant?: string }) => {
            if (variant === 'destructive') {
                toast.error(title, { description });
            } else {
                toast.success(title, { description });
            }
        }
    }
}
