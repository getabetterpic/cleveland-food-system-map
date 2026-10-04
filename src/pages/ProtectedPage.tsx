import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ProtectedPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  });

  return (
    <div>
      <h1>PRIVATE!</h1>
      <p>email reported as {user?.email}</p>
    </div>
  );
}
