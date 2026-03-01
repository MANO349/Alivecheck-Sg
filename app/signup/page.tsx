"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [role, setRole] = useState<"senior" | "caregiver">("senior");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function signup() {
    setErr("");
    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);

      // Save user profile (IMPORTANT: include email so caregiver dropdown can show it)
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        role,
        email,
      });

      // Create senior settings doc (default deadline)
      if (role === "senior") {
        await setDoc(
          doc(db, "seniors", cred.user.uid),
          { deadlineHour: 21, deadlineMinute: 0 },
          { merge: true }
        );
      }

      router.push(role === "caregiver" ? "/caregiver" : "/");
    } catch (e: any) {
      setErr("Unable to create account.");
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
            Sign up
          </h1>
          <div className="mt-3 w-16 h-1 bg-[#0ECA89] rounded-full" />
        </div>

        <label className="block text-sm font-semibold mb-1 text-gray-700">
          Name
        </label>
        <input
          className="w-full border border-gray-300 rounded-2xl p-4 mb-4 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="block text-sm font-semibold mb-1 text-gray-700">
          Role
        </label>
        <select
          className="w-full border border-gray-300 rounded-2xl p-4 mb-4 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89] transition"
          value={role}
          onChange={(e) => setRole(e.target.value as "senior" | "caregiver")}
        >
          <option value="senior">Senior</option>
          <option value="caregiver">Caregiver</option>
        </select>

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
          onClick={signup}
          disabled={loading}
          className="w-full bg-[#0ECA89] text-white rounded-2xl py-4 text-lg font-semibold hover:brightness-95 transition shadow-sm disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="mt-6 text-sm text-gray-600 text-center">
          Already have an account?{" "}
          <a className="underline font-semibold text-[#0ECA89]" href="/login">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}