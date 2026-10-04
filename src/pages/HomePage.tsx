import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function HomePage() {
  const { isAuthenticated, loading, logout, login } = useAuth();
  const navigate = useNavigate();

  const toLogin = () => {
    navigate("/login");
  };

  return (
    <div>
      <Outlet />
      {isAuthenticated && (
        <button
          className="top-2 right-2 absolute bg-blue-800 text-white rounded-sm px-5 py-2"
          type="button"
          onClick={logout}
        >
          Logout
        </button>
      )}
      {!isAuthenticated && (
        <button
          className="top-2 right-2 absolute bg-blue-800 text-white rounded-sm px-5 py-2"
          type="button"
          onClick={toLogin}
        >
          Login
        </button>
      )}
    </div>
  );
}
