"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Saklar pengingat harian via Web Push. Tersembunyi di browser yang tidak
 * mendukung (mis. tanpa service worker / PushManager).
 */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      Boolean(vapidPublicKey);
    if (!ok) return;
    setSupported(true);
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => setSupported(false));
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Izin notifikasi ditolak. Aktifkan lewat ikon gembok di address bar.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!response.ok) throw new Error("gagal menyimpan langganan");
      setSubscribed(true);
    } catch {
      setError("Gagal mengaktifkan pengingat. Coba lagi sebentar.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Gagal mematikan pengingat. Coba lagi sebentar.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => (subscribed ? disable() : enable())}
        disabled={busy}
        aria-pressed={subscribed}
        className={cn(
          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border-2 px-4 text-[0.875rem] font-extrabold transition-colors disabled:opacity-60",
          subscribed
            ? "border-primary-line bg-primary-soft text-primary-deep"
            : "border-hairline bg-surface text-ink hover:border-primary-line",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : subscribed ? <BellOff className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
        {subscribed ? "Pengingat aktif — matikan" : "Aktifkan pengingat harian"}
      </button>
      <span className="text-[0.75rem] text-ink-subtle">
        {subscribed
          ? "Lori mengingatkan kalau hari ini belum belajar."
          : "Notifikasi saat streak-mu terancam (maks 1×/hari)."}
      </span>
      {error ? (
        <span role="alert" className="rounded-[10px] bg-brick-soft px-3 py-1.5 text-[0.75rem] font-bold text-brick-deep">
          {error}
        </span>
      ) : null}
    </div>
  );
}
