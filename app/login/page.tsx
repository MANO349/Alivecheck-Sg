"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth } from "@/src/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"email" | "phone">("email");

  // email login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // phone login
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 🔥 setup recaptcha
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

  // ---------------- EMAIL LOGIN ----------------
  async function handleEmailLogin() {
    try {
      setLoading(true);
      setMessage("");

      await signInWithEmailAndPassword(auth, email, password);

      router.push("/caregiver"); // adjust if needed
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- FORGOT PASSWORD ----------------
  async function handleForgotPassword() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await sendPasswordResetEmail(auth, email);

      setMessage("Password reset email sent!");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- SEND OTP ----------------
  async function handleSendOtp() {
    try {
      setLoading(true);
      setMessage("");

      const appVerifier = window.recaptchaVerifier;

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        appVerifier
      );

      window.confirmationResult = confirmationResult;
      setOtpSent(true);
      setMessage("OTP sent!");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- VERIFY OTP ----------------
  async function handleVerifyOtp() {
    try {
      setLoading(true);
      setMessage("");

      await window.confirmationResult.confirm(otp);

      router.push("/caregiver");
    } catch (err: any) {
      setMessage("Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow">

        <h1 className="text-2xl font-bold mb-4 text-center">
          Login
        </h1>

        {/* TOGGLE */}
        <div className="flex mb-4 gap-2">
          <button
            onClick={() => setMode("email")}
            className={`flex-1 p-2 rounded-lg ${
              mode === "email" ? "bg-black text-white" : "bg-gray-200"
            }`}
          >
            Email
          </button>

          <button
            onClick={() => setMode("phone")}
            className={`flex-1 p-2 rounded-lg ${
              mode === "phone" ? "bg-black text-white" : "bg-gray-200"
            }`}
          >
            Phone
          </button>
        </div>

        {/* EMAIL LOGIN */}
        {mode === "email" && (
          <>
            <input
              type="email"
              placeholder="Email"
              className="w-full mb-3 p-3 border rounded-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full mb-2 p-3 border rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={handleForgotPassword}
              className="text-sm underline mb-3"
            >
              Forgot Password?
            </button>

            <button
              onClick={handleEmailLogin}
              disabled={loading}
              className="w-full bg-black text-white p-3 rounded-lg"
            >
              {loading ? "Loading..." : "Login"}
            </button>
          </>
        )}

        {/* PHONE LOGIN */}
        {mode === "phone" && (
          <>
            <input
              type="tel"
              placeholder="+65XXXXXXXX"
              className="w-full mb-3 p-3 border rounded-lg"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            {!otpSent ? (
              <button
                onClick={handleSendOtp}
                className="w-full bg-black text-white p-3 rounded-lg mb-3"
              >
                Send OTP
              </button>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Enter OTP"
                  className="w-full mb-3 p-3 border rounded-lg"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />

                <button
                  onClick={handleVerifyOtp}
                  className="w-full bg-black text-white p-3 rounded-lg"
                >
                  Verify OTP
                </button>
              </>
            )}
          </>
        )}

        {/* MESSAGE */}
        {message && (
          <p className="text-sm text-gray-600 mt-3 text-center">
            {message}
          </p>
        )}

        {/* recaptcha */}
        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}