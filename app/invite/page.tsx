"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthProvider";

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function InvitePage() {
  const { user } = useAuth();
  const [code, setCode] = useState("");

  async function generate() {
    if (!user) return;

    const newCode = makeCode(6);

    await setDoc(doc(db, "inviteCodes", newCode), {
      seniorId: user.uid,
      createdAt: serverTimestamp(),
      used: false,
    });

    setCode(newCode);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 border border-gray-200 text-center">

        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
          Generate Invite Code
        </h1>

        <button
          onClick={generate}
          className="w-full bg-[#0ECA89] text-white rounded-2xl py-4 text-lg font-semibold hover:brightness-95 transition"
        >
          Generate Code
        </button>

        {code && (
          <div className="mt-6 bg-gray-50 border rounded-2xl p-5">
            <p className="text-sm text-gray-600">Share this code:</p>
            <p className="text-4xl font-extrabold tracking-widest text-gray-900 mt-2">
              {code}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}