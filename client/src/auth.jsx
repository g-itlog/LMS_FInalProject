import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  async function restore() {
    setLoading(true);
    setUnavailable(false);
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch (error) {
      setUser(null);
      if (error.response?.status !== 401) setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    restore();
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, unavailable, restore, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
