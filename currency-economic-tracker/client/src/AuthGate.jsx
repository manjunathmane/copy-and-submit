import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App.jsx";
import { AuthPages } from "./AuthPages.jsx";

const devBypassAuth = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

function AuthLayout() {
  const [authenticated, setAuthenticated] = useState(devBypassAuth || Boolean(localStorage.getItem("currency_tracker_token")));

  const refreshAuth = () => setAuthenticated(devBypassAuth || Boolean(localStorage.getItem("currency_tracker_token")));

  return (
    <Routes>
      <Route path="/login" element={authenticated ? <Navigate to="/" replace /> : <AuthPages onAuthenticated={refreshAuth} />} />
      <Route path="/register" element={authenticated ? <Navigate to="/" replace /> : <AuthPages onAuthenticated={refreshAuth} />} />
      <Route path="/*" element={authenticated ? <App /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function AuthGate() {
  return (
    <BrowserRouter>
      <AuthLayout />
    </BrowserRouter>
  );
}
