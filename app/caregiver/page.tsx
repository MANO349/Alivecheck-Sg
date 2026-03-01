"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthProvider";

type CheckinType = "OK" | "HELP" | "EMERGENCY";

type SeniorProfile = {
  uid: string;
  name: string;
  email?: string;
};

function fmt2(n: number) {
  return String(n).padStart(2, "0");
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function todayKeySG() {
  // Simple “today” key in Singapore time (good enough for demo)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const sg = new Date(utc + 8 * 3600000);
  return `${sg.getFullYear()}-${fmt2(sg.getMonth() + 1)}-${fmt2(sg.getDate())}`;
}

export default function CaregiverPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  // Linking
  const [inviteCode, setInviteCode] = useState("");
  const [linkMsg, setLinkMsg] = useState("");
  const [linkedSeniors, setLinkedSeniors] = useState<string[]>([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState<string>("");

  // Profiles
  const [seniorProfiles, setSeniorProfiles] = useState<SeniorProfile[]>([]);
  const [profileMsg, setProfileMsg] = useState("");

  // Deadline settings
  const [deadlineHour, setDeadlineHour] = useState(21);
  const [deadlineMinute, setDeadlineMinute] = useState(0);
  const [saveMsg, setSaveMsg] = useState("");

  // Check-ins
  const [recentCheckins, setRecentCheckins] = useState<
    { type: CheckinType; at: Date | null }[]
  >([]);
  const [lastCheckInAt, setLastCheckInAt] = useState<Date | null>(null);
  const [lastCheckInType, setLastCheckInType] = useState<CheckinType | null>(
    null
  );
  const [checkinErr, setCheckinErr] = useState<string>("");

  // Notifications (Option 1)
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(
    null
  );
  const toastTimer = useRef<number | null>(null);

  const [notifHistory, setNotifHistory] = useState<
    { title: string; body: string; at: Date | null }[]
  >([]);

  // Guard
  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && role === "senior") router.push("/");
  }, [user, role, loading, router]);

  // Load notification setting
  useEffect(() => {
    const saved = localStorage.getItem("notifEnabled");
    setNotifEnabled(saved === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("notifEnabled", notifEnabled ? "1" : "0");
  }, [notifEnabled]);

  function showToast(title: string, body: string) {
    setToast({ title, body });
    // ✅ A) Vibration (mobile)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    // short-long-short pattern
    navigator.vibrate([80, 50, 120]);
  }
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }

  async function logNotification(title: string, body: string) {
    if (!user) return;
    if (!selectedSeniorId) return;

    // Firestore log (for report evidence)
    await addDoc(collection(db, "notifications"), {
      caregiverId: user.uid,
      seniorId: selectedSeniorId,
      title,
      body,
      createdAt: serverTimestamp(),
    });
  }

  async function notifyNow() {
    const seniorLabel = selectedLabel || "Senior";
    const title = "AliveCheck SG";
    const body = `Overdue: ${seniorLabel} has not checked in today.`;

    showToast(title, body);
    try {
      await logNotification(title, body);
    } catch (e) {
      // For demo, toast still works even if logging fails
      console.error(e);
    }
  }

  // Load linked seniors
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "caregivers", user.uid), (snap) => {
      const data: any = snap.data();
      const list: string[] = Array.isArray(data?.linkedSeniors)
        ? data.linkedSeniors
        : [];

      setLinkedSeniors(list);

      if (!selectedSeniorId && list.length > 0) setSelectedSeniorId(list[0]);
      if (list.length === 0) setSelectedSeniorId("");
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load profiles for dropdown labels
  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      setProfileMsg("");

      if (linkedSeniors.length === 0) {
        setSeniorProfiles([]);
        return;
      }

      try {
        const results = await Promise.all(
          linkedSeniors.map(async (uid) => {
            const snap = await getDoc(doc(db, "users", uid));
            const data: any = snap.data();

            return {
              uid,
              name: data?.name ?? "Unnamed",
              email: data?.email ?? "",
            } as SeniorProfile;
          })
        );

        if (!cancelled) setSeniorProfiles(results);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setSeniorProfiles(
            linkedSeniors.map((uid) => ({ uid, name: "Unnamed", email: "" }))
          );
          setProfileMsg("Could not load senior profiles (name/email).");
        }
      }
    }

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [linkedSeniors]);

  // Listen to deadline for selected senior
  useEffect(() => {
    if (!selectedSeniorId) return;

    const unsub = onSnapshot(doc(db, "seniors", selectedSeniorId), (snap) => {
      const d: any = snap.data();
      if (!d) return;
      setDeadlineHour(d.deadlineHour ?? 21);
      setDeadlineMinute(d.deadlineMinute ?? 0);
    });

    return () => unsub();
  }, [selectedSeniorId]);

  // Listen to last 7 check-ins
  useEffect(() => {
    if (!selectedSeniorId) return;

    setCheckinErr("");
    setRecentCheckins([]);
    setLastCheckInAt(null);
    setLastCheckInType(null);

    const q = query(
      collection(db, "checkins"),
      where("seniorId", "==", selectedSeniorId),
      orderBy("timestamp", "desc"),
      limit(7)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setRecentCheckins([]);
          setLastCheckInAt(null);
          setLastCheckInType(null);
          return;
        }

        const items = snap.docs.map((d) => {
          const data: any = d.data();
          const at = data?.timestamp?.toDate?.() ?? null;
          const type = (data?.type as CheckinType) ?? "OK";
          return { type, at };
        });

        setRecentCheckins(items);

        const first = items[0];
        setLastCheckInAt(first?.at ?? null);
        setLastCheckInType(first?.type ?? null);
      },
      (err) => {
        console.error(err);
        setCheckinErr(err?.message ?? "Unable to load check-ins.");
      }
    );

    return () => unsub();
  }, [selectedSeniorId]);

  // Notification history (last 10 for this caregiver + selected senior)
  useEffect(() => {
    if (!user || !selectedSeniorId) {
      setNotifHistory([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("caregiverId", "==", user.uid),
      where("seniorId", "==", selectedSeniorId),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            title: data?.title ?? "AliveCheck SG",
            body: data?.body ?? "",
            at: data?.createdAt?.toDate?.() ?? null,
          };
        });
        setNotifHistory(items);
      },
      (err) => {
        console.error(err);
      }
    );

    return () => unsub();
  }, [user, selectedSeniorId]);

  async function linkWithCode() {
    if (!user) return;
    setLinkMsg("");
    setSaveMsg("");
    setProfileMsg("");

    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setLinkMsg("Please enter a code.");
      return;
    }

    try {
      const codeRef = doc(db, "inviteCodes", code);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        setLinkMsg("Invalid code.");
        return;
      }

      const data: any = codeSnap.data();
      if (data.used) {
        setLinkMsg("This code has already been used.");
        return;
      }

      const seniorIdFromCode = data.seniorId as string;

      await setDoc(
        doc(db, "caregivers", user.uid),
        { linkedSeniors: [] },
        { merge: true }
      );

      await updateDoc(doc(db, "caregivers", user.uid), {
        linkedSeniors: arrayUnion(seniorIdFromCode),
      });

      await updateDoc(codeRef, { used: true });

      setInviteCode("");
      setLinkMsg("Linked successfully ✅");
      setSelectedSeniorId(seniorIdFromCode);
    } catch (e: any) {
      console.error(e);
      setLinkMsg(e?.message ?? "Failed to link.");
    }
  }

  async function saveDeadline() {
    if (!selectedSeniorId) return;
    setSaveMsg("");

    try {
      await setDoc(
        doc(db, "seniors", selectedSeniorId),
        { deadlineHour, deadlineMinute },
        { merge: true }
      );
      setSaveMsg(`Saved ✅ ${fmt2(deadlineHour)}:${fmt2(deadlineMinute)}`);
    } catch (e: any) {
      console.error(e);
      setSaveMsg(`Save failed: ${e?.message ?? "unknown error"}`);
    }
  }

  const status = useMemo(() => {
    if (!lastCheckInAt)
      return { label: "No check-ins yet", tone: "neutral" as const, overdue: false };

    const now = new Date();
    const checkedInToday = isSameDay(lastCheckInAt, now);

    const todayDeadline = new Date(now);
    todayDeadline.setHours(deadlineHour, deadlineMinute, 0, 0);

    const overdue = !checkedInToday && now > todayDeadline;

    if (checkedInToday) return { label: "Checked in today ✅", tone: "good" as const, overdue };
    if (overdue) return { label: "Overdue ⚠", tone: "bad" as const, overdue };
    return { label: "Not checked in today", tone: "neutral" as const, overdue };
  }, [lastCheckInAt, deadlineHour, deadlineMinute]);

  const typeBadge = useMemo(() => {
    if (!lastCheckInType) return null;
    if (lastCheckInType === "OK")
      return { text: "OK", cls: "bg-[#0ECA89] text-white" };
    if (lastCheckInType === "HELP")
      return { text: "HELP", cls: "bg-yellow-500 text-black" };
    return { text: "EMERGENCY", cls: "bg-red-600 text-white" };
  }, [lastCheckInType]);

  const selectedLabel = useMemo(() => {
    const found = seniorProfiles.find((s) => s.uid === selectedSeniorId);
    if (!found) return "";
    return `${found.name}${found.email ? ` (${found.email})` : ""}`;
  }, [seniorProfiles, selectedSeniorId]);

  // Auto-toast once per day per senior when overdue (only if enabled)
  useEffect(() => {
    if (!notifEnabled) return;
    if (!selectedSeniorId) return;
    if (!status.overdue) return;

    const key = `toastSent_${selectedSeniorId}_${todayKeySG()}`;
    const already = localStorage.getItem(key) === "1";
    if (already) return;

    // Show toast + log it
    notifyNow();

    localStorage.setItem(key, "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifEnabled, selectedSeniorId, status.overdue]);

  if (loading || !user) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-200 px-4">
      {/* Toast overlay */}
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
            <span className="text-xs text-gray-500">
              now
            </span>
          </div>

          <p className="text-sm text-gray-700 mt-1">
            {toast.body}
          </p>
        </div>
      </div>

    </div>
  </div>
)}

      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8 border border-gray-300">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => signOut(auth)}
            className="text-sm underline text-gray-700"
          >
            Log out
          </button>
        </div>

        {/* Centered logo + title */}
        <div className="flex flex-col items-center mb-6">
          <img
  src="/logo.png"
  alt="AliveCheck Logo"
  className="w-20 h-20 object-contain rounded-full bg-white p-3 shadow-md"
/>
          <h1 className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight text-center">
            Caregiver Dashboard
          </h1>
          <div className="mt-3 w-20 h-1 bg-[#0ECA89] rounded-full" />
        </div>

        <p className="text-sm text-gray-600 mb-6 text-center">
          Logged in as <span className="font-semibold">{user.email}</span>
        </p>

        {/* Notification toggle */}
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">Notifications (demo)</p>
              <p className="text-sm text-gray-600 mt-1">
                Shows a phone-style alert when a senior is overdue.
              </p>
            </div>

            <button
              onClick={() => setNotifEnabled((v) => !v)}
              className={`px-4 py-2 rounded-xl font-semibold transition ${
                notifEnabled
                  ? "bg-[#0ECA89] text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              {notifEnabled ? "Enabled" : "Enable"}
            </button>
          </div>
        </div>

        {/* Link via invite code */}
        <div className="bg-gray-50 border rounded-2xl p-5 mb-6">
          <p className="font-semibold text-gray-900 mb-2">
            Link to a senior (Invite Code)
          </p>

          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89]"
              placeholder="Enter 6-letter code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <button
              onClick={linkWithCode}
              className="bg-[#0ECA89] text-white rounded-xl px-4 font-semibold hover:brightness-95 transition"
            >
              Link
            </button>
          </div>

          {linkMsg && <p className="text-sm text-gray-700 mt-2">{linkMsg}</p>}
        </div>

        {/* Select senior */}
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-gray-800 mb-2">
            Linked seniors
          </p>

          {linkedSeniors.length === 0 ? (
            <p className="text-sm text-gray-600">
              No seniors linked yet. Use an invite code above.
            </p>
          ) : (
            <>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89]"
                value={selectedSeniorId}
                onChange={(e) => setSelectedSeniorId(e.target.value)}
              >
                {seniorProfiles.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.name}
                    {s.email ? ` (${s.email})` : ""}
                  </option>
                ))}
              </select>

              {profileMsg && (
                <p className="text-xs text-red-600 mt-2">{profileMsg}</p>
              )}

              <p className="text-xs text-gray-500 mt-2">
                Selected: <span className="font-semibold">{selectedLabel}</span>
              </p>
            </>
          )}
        </div>

        {/* Overdue banner + notify button */}
        {linkedSeniors.length > 0 && status.tone === "bad" && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-red-700 font-extrabold text-lg">Overdue</p>
            <p className="text-red-700 text-sm mt-1">
              No check-in today and the deadline has passed.
            </p>

            <button
              onClick={notifyNow}
              className="mt-4 w-full bg-[#0ECA89] text-white rounded-2xl py-3 font-semibold hover:brightness-95 transition"
            >
              Notify now (demo)
            </button>
          </div>
        )}

        {/* Last check-in */}
        <div className="bg-gray-50 border rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold text-gray-900">Last check-in</p>
            {typeBadge && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold ${typeBadge.cls}`}
              >
                {typeBadge.text}
              </span>
            )}
          </div>

          {checkinErr ? (
            <p className="text-sm text-red-600 mt-2">{checkinErr}</p>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-900 mt-2">
                {lastCheckInAt
                  ? lastCheckInAt.toLocaleString("en-SG")
                  : "No check-ins yet"}
              </p>

              <p
                className={`mt-3 font-semibold ${
                  status.tone === "good"
                    ? "text-[#0ECA89]"
                    : status.tone === "bad"
                    ? "text-red-700"
                    : "text-gray-700"
                }`}
              >
                {status.label}
              </p>
            </>
          )}
        </div>

        {/* Recent check-ins */}
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            Recent check-ins (last 7)
          </p>

          {checkinErr ? (
            <p className="text-sm text-red-600">{checkinErr}</p>
          ) : recentCheckins.length === 0 ? (
            <p className="text-sm text-gray-600">No check-ins yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentCheckins.map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-semibold text-gray-900">{c.type}</span>
                  <span className="text-gray-600">
                    {c.at ? c.at.toLocaleString("en-SG") : "Pending..."}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notification history */}
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            Notification history (demo)
          </p>

          {notifHistory.length === 0 ? (
            <p className="text-sm text-gray-600">No notifications yet.</p>
          ) : (
            <ul className="space-y-2">
              {notifHistory.map((n, i) => (
                <li key={i} className="text-sm">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  <p className="text-gray-700">{n.body}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.at ? n.at.toLocaleString("en-SG") : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Deadline settings */}
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-lg font-semibold text-gray-900 mb-4">
            Daily check-in deadline
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Hour (0–23)
              </label>
              <input
                type="number"
                min={0}
                max={23}
                className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89]"
                value={deadlineHour}
                onChange={(e) => setDeadlineHour(Number(e.target.value))}
                disabled={!selectedSeniorId}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Minute (0–59)
              </label>
              <input
                type="number"
                min={0}
                max={59}
                className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ECA89]"
                value={deadlineMinute}
                onChange={(e) => setDeadlineMinute(Number(e.target.value))}
                disabled={!selectedSeniorId}
              />
            </div>
          </div>

          <button
            onClick={saveDeadline}
            disabled={!selectedSeniorId}
            className="w-full bg-[#0ECA89] text-white rounded-2xl py-4 text-lg font-semibold hover:brightness-95 transition disabled:opacity-40"
          >
            Save deadline
          </button>

          {saveMsg && <p className="text-sm text-gray-700 mt-3">{saveMsg}</p>}
        </div>
      </div>
    </main>
  );
}