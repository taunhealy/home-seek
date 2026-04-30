"use client";

import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { AuthProvider } from "@/lib/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const initialOptions = {
    "clientId": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
    intent: "subscription",
    vault: true,
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </PayPalScriptProvider>
  );
}
