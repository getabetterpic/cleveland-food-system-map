import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapPage from "./pages/MapPage";
import LoginPage from "./pages/LoginPage";
import CallbackPage from "./pages/CallbackPage";
import ProtectedPage from "./pages/ProtectedPage";
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />}>
            <Route index element={<MapPage />} />
            <Route path="maps" element={<MapPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="callback" element={<CallbackPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}
