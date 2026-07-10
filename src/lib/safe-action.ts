export type SafeActionResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export function withSafeAction<Args extends any[], Return>(
  actionFn: (...args: Args) => Promise<Return>
): (...args: Args) => Promise<SafeActionResponse<Return>> {
  return async (...args: Args): Promise<SafeActionResponse<Return>> => {
    try {
      const data = await actionFn(...args);
      return { success: true, data };
    } catch (error: any) {
      // In development, we can log the exact error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error("Safe Action Error Caught:", error);
      }

      // Check if it's a known validation error (usually generic Error instances thrown manually)
      // Prisma errors, on the other hand, often have distinct codes or constructors
      const isPrismaError = error?.code?.startsWith('P') || error?.name === 'PrismaClientKnownRequestError';
      
      if (isPrismaError) {
        // Log critical database errors internally
        console.error("Critical DB Error in Action:", error);
        return { 
          success: false, 
          error: "A database error occurred. Please try again later.",
          code: "DB_ERROR" 
        };
      }

      // If it's a standard Error thrown by our validations (e.g. throw new Error("Unauthorized"))
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }

      // Generic fallback
      return { success: false, error: "An unexpected error occurred." };
    }
  };
}
