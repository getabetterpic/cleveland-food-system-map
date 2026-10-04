import { useAuth } from "../contexts/AuthContext";
import supabase from "../lib/supabase";

export default function LoginPage() {
  const { login } = useAuth();
  const loginToGithub = () => {
    supabase.auth
      .signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: "http://localhost:5173/callback",
        },
      })
      .then((resp) => {
        console.log({ resp });
        login(resp.data);
      });
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form>
        <button
          type="button"
          onClick={loginToGithub}
          className="w-full rounded-sm bg-gray-800 text-white py-2 px-4 hover:bg-gray-700"
        >
          Sign in with GitHub
        </button>
      </form>
    </div>
  );
}
