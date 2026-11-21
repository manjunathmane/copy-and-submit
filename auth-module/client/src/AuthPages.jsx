import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, LockKeyhole, Mail, UserRound } from "lucide-react";
import "./auth.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function send(path, payload) {
  const response = await fetch(`${API}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

function AuthInput({ icon: Icon, label, ...props }) {
  return <label className="auth-field">
    <span>{label}</span>
    <div className="auth-input-wrap"><Icon size={16} aria-hidden="true"/><input {...props}/></div>
  </label>;
}

export function AuthPages({ onAuthenticated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = location.pathname === "/register";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function requestOtp() {
    setError(""); setMessage("");
    if (!username.trim() || !email.trim() || !password) return setError("Complete the username, email and password fields first.");
    setBusy(true);
    try {
      await send("/request-otp", { username: username.trim(), email: email.trim(), password });
      setOtpSent(true); setResendIn(60); setMessage("A 4-digit verification code has been sent to your email.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      if (isRegister) {
        if (!otpSent) throw new Error("Request an email OTP before registering.");
        await send("/verify-register", { username: username.trim(), email: email.trim(), password, otp });
        setMessage("Your account has been created. You can now log in.");
        setTimeout(() => navigate("/login"), 900);
      } else {
        const result = await send("/login", { username: username.trim(), password });
        localStorage.setItem("currency_tracker_token", result.token);
        onAuthenticated();
        navigate("/", { replace: true });
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

  return <main className="auth-page">
    <section className={`auth-card ${isRegister ? "auth-card-register" : ""}`}>
      <div className="auth-brand"><div className="auth-brand-mark">C<span>.</span></div><div><strong> CURRENCY TRACKER</strong><small>INTERNATIONAL MARKETS & ECONOMIC DATA</small></div></div>
      <div className="auth-heading"><span className="auth-eyebrow">ACCOUNT ACCESS</span><h1>{isRegister ? "Register" : "Login"}</h1><p>{isRegister ? "Create an account to access your dashboard." : "Sign in to continue to your dashboard."}</p></div>
      <form onSubmit={submit} className="auth-form">
        <AuthInput icon={UserRound} label="Username" placeholder="Enter your username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required />
        {isRegister && <AuthInput icon={Mail} label="Email" type="email" placeholder="Enter your email address" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required />}
        <AuthInput icon={LockKeyhole} label={isRegister ? "Set Password" : "Password"} type="password" placeholder={isRegister ? "Create a strong password" : "Enter your password"} autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} required />
        {isRegister && <div className="password-rules"><span className={password.length>=8?"rule-ok":""}>8+ characters</span><span className={/[A-Z]/.test(password)?"rule-ok":""}>Uppercase</span><span className={/[a-z]/.test(password)?"rule-ok":""}>Lowercase</span><span className={/\d/.test(password)?"rule-ok":""}>Number</span><span className={/[^A-Za-z0-9]/.test(password)?"rule-ok":""}>Symbol</span></div>}
        {isRegister && <div className="otp-row"><AuthInput icon={LockKeyhole} label="OTP" inputMode="numeric" maxLength={4} placeholder="4-digit code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g, "").slice(0,4))} required />
          <button type="button" className="resend-btn" onClick={requestOtp} disabled={busy || resendIn>0}>{!otpSent ? "Send OTP" : resendIn>0 ? `Resend in ${resendIn}s` : "Resend OTP"}</button>
        </div>}
        {error && <div className="auth-alert auth-error" role="alert">{error}</div>}
        {message && <div className="auth-alert auth-success" role="status">{message}</div>}
        <button className="auth-submit" type="submit" disabled={busy || (isRegister && (!otpSent || !passwordValid || otp.length!==4))}>{busy ? "Please wait…" : isRegister ? "Register" : "Login"}</button>
      </form>
      <div className="auth-switch">{isRegister ? "Already have an account?" : "Don't have an account yet?"} <button type="button" onClick={()=>{setError("");setMessage("");navigate(isRegister?"/login":"/register");}}> {isRegister ? "Login" : "Register"}</button></div>
      <div className="auth-foot"><span>SECURE ACCOUNT ACCESS</span><span>FX • ECONOMICS • GLOBAL MARKETS</span></div>
    </section>
  </main>;
}
