"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setErr("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const role = (snap.data()?.role as string) || "senior";

      router.push(role === "caregiver" ? "/caregiver" : "/");
    } catch (e: any) {
      setErr("Invalid email or password.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-200 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-gray-300">
        {/* Centered Logo + Title + underline */}
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

        <label className="block text-sm font-semibold mb-1 text-gray-700">
          Email
        </label>
        <input
          className="w-full border border-gray-300 rounded-2xl p-4 mb-4 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block text-sm font-semibold mb-1 text-gray-700">
          Password
        </label>
        <input
          type="password"
          className="w-full border border-gray-300 rounded-2xl p-4 mb-6 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />

        {err && (
          <p className="text-red-600 text-sm mb-4 font-medium text-center">
            {err}
          </p>
        )}

        <button
          onClick={login}
          disabled={loading}
          className="w-full bg-[#0ECA89] text-white rounded-2xl py-4 text-lg font-semibold hover:brightness-95 transition shadow-sm disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Log in"}
        </button>

        <p className="mt-6 text-sm text-gray-600 text-center">
          No account?{" "}
          <a className="underline font-semibold text-[#0ECA89]" href="/signup">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}