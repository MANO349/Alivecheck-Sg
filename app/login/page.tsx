"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"email" | "phone">("email");

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
        }
      );
    }
  }, []);

  async function routeUser(uid: string) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const role = (snap.data()?.role as string) || "senior";
      router.push(role === "caregiver" ? "/caregiver" : "/");
    } catch {
      router.push("/");
    }
  }

  async function login() {
    setErr("");
    setInfo("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      await routeUser(cred.user.uid);
    } catch {
      setErr("Invalid email or password.");
    }

    setLoading(false);
  }

  async function forgotPassword() {
    setErr("");
    setInfo("");

    if (!email.trim()) {
      setErr("Please enter your email first.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setInfo("Password reset email sent. Please check your inbox.");
    } catch {
      setErr("Unable to send reset email.");
    }

    setLoading(false);
  }

  async function sendOtp() {
    setErr("");
    setInfo("");

    try {
      setLoading(true);

      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) {
        setErr("Recaptcha not ready.");
        setLoading(false);
        return;
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        appVerifier
      );

      window.confirmationResult = confirmationResult;
      setOtpSent(true);
      setInfo("OTP sent to your phone.");
    } catch {
      setErr("Failed to send OTP. Check your phone number format.");
    }

    setLoading(false);
  }

  async function verifyOtp() {
    setErr("");
    setInfo("");

    try {
      setLoading(true);

      if (!window.confirmationResult) {
        setErr("Please request an OTP first.");
        setLoading(false);
        return;
      }

      const cred = await window.confirmationResult.confirm(otp);
      await routeUser(cred.user.uid);
    } catch {
      setErr("Invalid OTP.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-200 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-gray-300">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/logo.png"
            alt="AliveCheck Logo"
            className="w-20 h-20 object-contain rounded-full bg-white p-3 shadow-md"
          />
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900 tracking-tight text-center">
            Log in
          </h1>
          <div className="mt-3 w-16 h-1 bg-[#0ECA89] rounded-full" />
        </div>

        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode("email");
              setErr("");
              setInfo("");
            }}
            className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition ${
              mode === "email"
                ? "bg-[#0ECA89] text-white"
                : "bg-gray-100 text-gray-700 border border-gray-300"
            }`}
          >
            Email
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("phone");
              setErr("");
              setInfo("");
            }}
            className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition ${
              mode === "phone"
                ? "bg-[#0ECA89] text-white"
                : "bg-gray-100 text-gray-700 border border-gray-300"
            }`}
          >
            Phone
          </button>
        </div>

        {mode === "email" ? (
          <>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Email
            </label>
            <input
              type="email"
              placeholder="Email"
              className="w-full border border-gray-300 rounded-2xl p-4 mb-4 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Password
            </label>
            <input
              type="password"
              placeholder="Password"
              className="w-full border border-gray-300 rounded-2xl p-4 mb-2 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />

            <button
              type="button"
              onClick={forgotPassword}
              className="text-sm text-[#0ECA89] underline mb-5"
            >
              Forgot Password?
            </button>

            <button
              onClick={login}
              disabled={loading}
              className="w-full bg-[#0ECA89] text-white rounded-2xl py-4 text-lg font-semibold hover:brightness-95 transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Log in"}
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+65XXXXXXXX"
              className="w-full border border-gray-300 rounded-2xl p-4 mb-4 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            {!otpSent ? (
              <button
                onClick={sendOtp}
                disabled={loading}
                className="w-full bg-[#0ECA89] text-white rounded-2xl py-4 text-lg font-semibold hover:brightness-95 transition shadow-sm disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            ) : (
              <>
                <label className="block text-sm font-semibold mb-1 mt-1 text-gray-700">
                  OTP Code
                </label>
                <input
                  type="text"
                  placeholder="Enter OTP"
                  className="w-full border border-gray-300 rounded-2xl p-4 mb-4 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />

                <button
                  onClick={verifyOtp}
                  disabled={loading}
                  className="w-full bg-[#0ECA89] text-white rounded-2xl py-4 text-lg font-semibold hover:brightness-95 transition shadow-sm disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
              </>
            )}
          </>
        )}

        {err && (
          <p className="text-red-600 text-sm mt-4 font-medium text-center">
            {err}
          </p>
        )}

        {info && (
          <p className="text-[#0ECA89] text-sm mt-4 font-medium text-center">
            {info}
          </p>
        )}

        <p className="mt-6 text-sm text-gray-600 text-center">
          No account?{" "}
          <a className="underline font-semibold text-[#0ECA89]" href="/signup">
            Sign up
          </a>
        </p>

        <div id="recaptcha-container" />
      </div>
    </main>
  );
}