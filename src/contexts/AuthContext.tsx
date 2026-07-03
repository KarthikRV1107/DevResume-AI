import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const validateSession = async (nextSession: Session | null) => {
      if (!nextSession?.access_token) {
        if (mounted) setSession(null);
        return;
      }

      const { data, error } = await supabase.auth.getUser(nextSession.access_token);
      if (error || !data.user) {
        await supabase.auth.signOut();
        if (mounted) setSession(null);
        return;
      }

      if (mounted) setSession(nextSession);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        validateSession(session).finally(() => {
          if (mounted) setLoading(false);
        });
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      validateSession(session).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
