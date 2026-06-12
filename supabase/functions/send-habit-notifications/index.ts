// Supabase Edge Function: send-habit-notifications (S16)
//
// Triggered by pg_cron every 5 minutes (see supabase/sql/S16_push_notifications.sql,
// part B). Finds habits whose reminder time (habits.notify_time, local time in
// NOTIFY_TZ) has just passed today and sends a web push to all of the user's
// subscribed browsers. The notification carries the dream's image and the
// positive + negative motivation (dream's values, falling back to the habit's).
//
// Secrets (Edge Functions → Secrets):
//   VAPID_KEYS    — JSON {publicKey, privateKey} JWKs (scripts/generate-vapid-keys.mjs)
//   CONTACT_EMAIL — e-mail for the VAPID "mailto:" contact (optional)
//   NOTIFY_TZ     — IANA timezone, default "Europe/Prague" (optional)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const TZ = Deno.env.get("NOTIFY_TZ") ?? "Europe/Prague";
// A reminder is sent when now >= notify_time and at most this many minutes
// have passed (so a long cron outage doesn't fire stale reminders at night).
// Deduped to once per day via habits.last_notified_date.
const CATCH_UP_MINUTES = 90;

type HabitRow = {
  id: number;
  user_id: string;
  name: string;
  goal_id: number | null;
  image: string | null;
  positive_motivation: string | null;
  negative_motivation: string | null;
  notify_time: string; // "HH:MM:SS"
  last_notified_date: string | null;
};

function nowInTz(tz: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { date: today, minutes: nowMinutes } = nowInTz(TZ);

    const { data: habits, error: habitsError } = await supabase
      .from("habits")
      .select(
        "id, user_id, name, goal_id, image, positive_motivation, negative_motivation, notify_time, last_notified_date"
      )
      .eq("notify", true)
      .not("notify_time", "is", null);
    if (habitsError) throw habitsError;

    const due = ((habits ?? []) as HabitRow[]).filter((h) => {
      if (h.last_notified_date === today) return false;
      const target = timeToMinutes(h.notify_time);
      return nowMinutes >= target && nowMinutes - target <= CATCH_UP_MINUTES;
    });

    if (due.length === 0) {
      return Response.json({ sent: 0, checked: habits?.length ?? 0 });
    }

    // Resolve habit → goal → dream for the image + motivations.
    const goalIds = [...new Set(due.map((h) => h.goal_id).filter(Boolean))];
    const { data: goals } = goalIds.length
      ? await supabase.from("goals").select("id, dream_id").in("id", goalIds)
      : { data: [] };
    const dreamIds = [...new Set((goals ?? []).map((g) => g.dream_id))];
    const { data: dreams } = dreamIds.length
      ? await supabase
          .from("dreams")
          .select("id, name, image, positive_motivation, negative_motivation")
          .in("id", dreamIds)
      : { data: [] };
    const goalById = new Map((goals ?? []).map((g) => [g.id, g]));
    const dreamById = new Map((dreams ?? []).map((d) => [d.id, d]));

    const userIds = [...new Set(due.map((h) => h.user_id))];
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);
    if (subsError) throw subsError;

    const vapidKeys = await webpush.importVapidKeys(
      JSON.parse(Deno.env.get("VAPID_KEYS")!),
      { extractable: false }
    );
    const appServer = await webpush.ApplicationServer.new({
      contactInformation:
        "mailto:" + (Deno.env.get("CONTACT_EMAIL") ?? "admin@example.com"),
      vapidKeys,
    });

    let sent = 0;
    const goneSubIds: number[] = [];

    for (const habit of due) {
      const goal = habit.goal_id ? goalById.get(habit.goal_id) : undefined;
      const dream = goal ? dreamById.get(goal.dream_id) : undefined;

      const positive = dream?.positive_motivation || habit.positive_motivation;
      const negative = dream?.negative_motivation || habit.negative_motivation;
      const bodyLines = [
        positive ? `✨ ${positive}` : null,
        negative ? `⚠️ ${negative}` : null,
      ].filter(Boolean);
      if (bodyLines.length === 0 && dream?.name) {
        bodyLines.push(`Keep working towards: ${dream.name}`);
      }

      const payload = JSON.stringify({
        title: `⏰ ${habit.name}`,
        body: bodyLines.join("\n"),
        image: dream?.image || habit.image || undefined,
        icon: "/icons/icon-512.png",
        tag: `habit-${habit.id}`,
        url: "/habits",
      });

      const userSubs = (subs ?? []).filter((s) => s.user_id === habit.user_id);
      for (const sub of userSubs) {
        try {
          const subscriber = appServer.subscribe({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          });
          await subscriber.pushTextMessage(payload, {});
          sent++;
        } catch (err) {
          // 404/410 = the browser unsubscribed; drop the dead subscription.
          const status = (err as { response?: { status?: number } })?.response
            ?.status;
          if (status === 404 || status === 410) {
            goneSubIds.push(sub.id);
          } else {
            console.error(`Push to subscription ${sub.id} failed:`, err);
          }
        }
      }

      await supabase
        .from("habits")
        .update({ last_notified_date: today })
        .eq("id", habit.id);
    }

    if (goneSubIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", goneSubIds);
    }

    return Response.json({ sent, due: due.length, removed: goneSubIds.length });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
