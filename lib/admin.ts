export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  
  if (adminEmails.length === 0) {
    console.warn("Warning: ADMIN_EMAILS not configured");
    return false;
  }
  
  return adminEmails.includes(email.toLowerCase());
}