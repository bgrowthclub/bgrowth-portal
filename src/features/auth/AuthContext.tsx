import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabaseClient";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  // Set when an e-mail link (?token_hash=…) was expired or already used.
  linkError: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Links in our e-mails point at this app (?token_hash=…&type=…) instead
    // of the Supabase address, so they don't look like spam (decided
    // 19/10/2026; the Supabase e-mail templates use {{ .RedirectTo }}). The
    // token is confirmed here before the session is read. Old-style links
    // keep working.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const TYPES = ["signup", "recovery", "email_change", "email", "invite", "magiclink"] as const;
    const verify =
      tokenHash && TYPES.includes(type as (typeof TYPES)[number])
        ? (() => {
            params.delete("token_hash");
            params.delete("type");
            const rest = params.toString();
            window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
            return supabase.auth
              .verifyOtp({ token_hash: tokenHash, type: type as (typeof TYPES)[number] })
              .then(({ error }) => {
                if (error) setLinkError("This link has expired or was already used. Ask for a new one.");
              });
          })()
        : Promise.resolve();

    verify
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
        setSession(data.session);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isLoading, linkError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
