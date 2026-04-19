export type Role = "admin" | "user";

export interface Invite {
  email: string;
  role: Role;
}

// Add invited users here. Only these emails can register.
export const INVITED_EMAILS: Invite[] = [
  { email: "jnorman67utfan@gmail.com", role: "admin" },
  { email: "jnorman67utfan+koshuser@gmail.com", role: "user" },
  { email: "drkosh@sbcglobal.net", role: "user" },
  { email: "deidra.ryan.cpa@gmail.com", role: "user" },
];

export function findInvite(email: string): Invite | undefined {
  return INVITED_EMAILS.find(
    (inv) => inv.email.toLowerCase() === email.toLowerCase(),
  );
}
