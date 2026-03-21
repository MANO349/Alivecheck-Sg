"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthProvider";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Singapore “today” key
function todayKeySG() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const sg = new Date(utc + 8 * 3600000);
  const yyyy = sg.getFullYear();
  const mm = pad2(sg.getMonth() + 1);
  const dd = pad2(sg.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export default function Home() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [deadlineHour, setDeadlineHour] = useState(21);
  const [deadlineMinute, setDeadlineMinute] = useState(0);

  const [lastCheckIn, setLastCheckIn] = useState<string>("Not yet");
  const [checkedToday, setCheckedToday] = useState(false);
  const [gentleReminder, setGentleReminder] = useState(false);

  const [toast, setToast] = useState<{ title: string; body: string } | null>(
    null
  );
  const toastTimer = useRef<number | null>(null);

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  function showToast(title: string, body: string) {
    setToast({ title, body });

    // softer vibration
    vibrate(80);

    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && role === "caregiver") router.push("/caregiver");
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "seniors", user.uid), (snap) => {
      const data: any = snap.data();
      if (!data) return;
      setDeadlineHour(data.deadlineHour ?? 21);
      setDeadlineMinute(data.deadlineMinute ?? 0);
    });

    return () => unsub();
  }, [user]);

  async function writeCheckin(type: "OK" | "HELP" | "EMERGENCY") {
    if (!user) return;

    if (type === "OK") vibrate(80);
    if (type === "HELP") vibrate([80, 60, 80]);
    if (type === "EMERGENCY") vibrate([160, 80, 160]);

    await addDoc(collection(db, "checkins"), {
      seniorId: user.uid,
      type,
      timestamp: serverTimestamp(),
    });

    const now = new Date();
    setLastCheckIn(now.toLocaleString("en-SG"));
    setCheckedToday(true);
    setGentleReminder(false);

    if (type === "OK") showToast("AliveCheck SG", "Check-in sent ✅");
    if (type === "HELP") showToast("AliveCheck SG", "Help request sent ✅");
    if (type === "EMERGENCY") showToast("AliveCheck SG", "Emergency alert sent ✅");
  }

  const { nextDeadline, missedToday, reminderActive } = useMemo(() => {
    const now = new Date();

    const todayDeadline = new Date(now);
    todayDeadline.setHours(deadlineHour, deadlineMinute, 0, 0);

    const next = new Date(todayDeadline);
    if (now > todayDeadline) next.setDate(next.getDate() + 1);

    const missed = !checkedToday && now > todayDeadline;

    const gentleReminderTime = new Date(todayDeadline);
    gentleReminderTime.setHours(deadlineHour - 1, deadlineMinute, 0, 0);

    const active = !checkedToday && now >= gentleReminderTime && now <= todayDeadline;

    return { nextDeadline: next, missedToday: missed, reminderActive: active };
  }, [deadlineHour, deadlineMinute, checkedToday]);

  useEffect(() => {
    setGentleReminder(reminderActive);

    if (!reminderActive) return;

    const key = `senior_gentle_reminder_${todayKeySG()}`;
    const already = localStorage.getItem(key) === "1";
    if (already) return;

    showToast("AliveCheck SG", "Friendly reminder: please check in by tonight.");
    localStorage.setItem(key, "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderActive]);

  if (loading || !user) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-200 px-4">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-slideDown">
          <div className="backdrop-blur-xl bg-white/90 border border-gray-200 shadow-2xl rounded-3xl p-4 transition-all duration-300">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="AliveCheck"
                className="w-10 h-10 object-contain"
              />

              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-extrabold text-gray-900">
                    {toast.title}
                  </p>
                  <span className="text-xs text-gray-500">now</span>
                </div>

                <p className="text-sm text-gray-700 mt-1">{toast.body}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-gray-300 text-center">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => signOut(auth)}
            className="text-sm underline text-gray-700"
          >
            Log out
          </button>
        </div>

        <div className="flex flex-col items-center mb-6">
          <img
            src="/logo.png"
            alt="AliveCheck Logo"
            className="w-20 h-20 object-contain rounded-full bg-white p-3 shadow-md"
          />
          <h1 className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight text-center">
            AliveCheck SG
          </h1>
          <div className="mt-3 w-20 h-1 bg-[#0ECA89] rounded-full" />
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Logged in as <span className="font-semibold">{user.email}</span>
        </p>

        <div className="mb-6 text-left bg-gray-50 rounded-2xl p-5 border">
          <p className="text-lg font-semibold text-gray-900">
            Daily check-in reminder
          </p>

          <p
            className={`text-2xl mt-2 font-extrabold ${
              checkedToday
                ? "text-[#0ECA89]"
                : missedToday
                ? "text-amber-700"
                : "text-gray-900"
            }`}
          >
            {nextDeadline.toLocaleString("en-SG", {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>

          <p className="mt-2 text-base text-gray-700">
            Next check-in by{" "}
            <span className="font-semibold">
              {nextDeadline.toLocaleTimeString("en-SG", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </p>

          {gentleReminder && !checkedToday && (
            <div className="mt-3 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-3">
              <p className="text-sm font-semibold text-[#047857]">
                Friendly reminder
              </p>
              <p className="text-sm text-[#065F46] mt-1">
                Please remember to complete today’s check-in by tonight.
              </p>
            </div>
          )}

          {missedToday && (
            <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm font-semibold text-amber-800">
                Check-in still needed
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Please tap when you’re ready.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => writeCheckin("OK")}
          className="w-full bg-[#0ECA89] text-white text-3xl font-extrabold py-8 rounded-3xl shadow-md hover:brightness-95 transition active:scale-[0.99]"
        >
          I’m OK
        </button>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            className="w-full bg-yellow-500 text-black text-xl font-extrabold py-4 rounded-2xl shadow-sm hover:brightness-95 transition"
            onClick={() => writeCheckin("HELP")}
          >
            Need Help?
          </button>

          <button
            className="w-full bg-red-600 text-white text-xl font-extrabold py-4 rounded-2xl shadow-sm hover:bg-red-700 transition"
            onClick={() => writeCheckin("EMERGENCY")}
          >
            EMERGENCY
          </button>
        </div>

        <div className="mt-6 text-left bg-white rounded-2xl p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-800">Last check-in</p>
          <p
            className={`text-lg mt-1 font-semibold ${
              checkedToday ? "text-[#0ECA89]" : "text-gray-700"
            }`}
          >
            {lastCheckIn}
          </p>
        </div>

        <div className="mt-6">
          <button
            onClick={() => router.push("/invite")}
            className="text-sm text-gray-700 font-semibold underline hover:text-gray-900 transition"
          >
            Generate Invite Code
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Gentle reminders are shown in-app before the daily deadline.
        </p>
      </div>
    </main>
  );
}