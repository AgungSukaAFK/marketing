"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type OnlineUser = { user_id: string; name: string; username: string; role: string; online_at: string };

const PresenceContext = createContext<OnlineUser[]>([]);

export const useOnlineUsers = () => useContext(PresenceContext);

/**
 * Supabase Realtime Presence (menggantikan heartbeat setInterval prototipe).
 * Channel privat "tenant:<id>" — RLS realtime.messages membatasi ke anggota tenant.
 */
export function PresenceProvider({
  tenantId,
  me,
  children,
}: {
  tenantId: string;
  me: Omit<OnlineUser, "online_at">;
  children: React.ReactNode;
}) {
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const { user_id, name, username, role } = me;

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const channel = supabase.channel(`tenant:${tenantId}`, {
      config: { private: true, presence: { key: user_id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<OnlineUser>();
      // satu user bisa buka beberapa tab → ambil satu entri per key
      setOnline(Object.values(state).map((metas) => metas[0]).filter(Boolean));
    });

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id, name, username, role, online_at: new Date().toISOString() });
        }
      });
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tenantId, user_id, name, username, role]);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}
