import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";

export default function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user != null) {
        navigate("/maps", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    });
  });
  return <div></div>;
}
