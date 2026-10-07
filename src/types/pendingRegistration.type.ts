export interface PendingRegistration {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  password: string;
  otp: string;
  role: "user" | "admin";
}
