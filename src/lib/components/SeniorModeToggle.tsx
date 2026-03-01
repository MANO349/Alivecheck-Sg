"use client";

import { useEffect, useState } from "react";
import { getSeniorMode, setSeniorMode } from "@/src/lib/uiPrefs";

export default function SeniorModeToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => setOn(getSeniorMode()), []);

  function toggle() {
    const next = !on;
    setOn(next);
    setSeniorMode(next);
    // quick refresh to apply sizing class if you use it in pages
    window.location.reload();
  }

  return (
    <button
      onClick={toggle}
      className={`rounded-xl px-3 py-2 text-sm font-semibold border ${
        on
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-white border-gray-200 text-gray-700"
      }`}
    >
      {on ? "Senior mode: ON" : "Senior mode"}
    </button>
  );
}