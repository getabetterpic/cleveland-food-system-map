import {
  createContext,
  type SubmitEvent,
  useState,
  useContext,
  useEffect,
} from "react";
import supabase from "../lib/supabase";

type AuthContextType = {
  isAuthenticated: boolean;
  user: { email?: string } | null;
  login: (e: SubmitEvent) => void;
  logout: (e: Event) => void;
  loading: boolean;
  error: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      supabase.auth.getUser().then(({ data }) => {
        console.log({ data });
        const { session } = data;
        if (session?.user != null) {
          setIsAuthenticated(true);
          setUser({ email: session?.user?.email });
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      });
    }
  }, [isAuthenticated]);

  const login = (user) => {
    if (user != null) {
      const { email } = user;
      setUser({ email });
      setIsAuthenticated(true);
      setLoading(false);
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  const logout = (e: Event) => {
    e.preventDefault();

    setLoading(true);
    supabase.auth.signOut().then(() => {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    });
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, login, logout, user, loading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { AuthProvider, useAuth };
