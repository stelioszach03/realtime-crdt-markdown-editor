// Debug utility to track authentication flow
export const debugAuth = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    console.log(`[AUTH DEBUG] ${message}`, data || '');
  }
};