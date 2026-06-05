"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ACCENT_STYLE } from "@/components/ui";

export default function Home() {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(me ? "/setup" : "/login");
  }, [me, loading, router]);

  return <div className="viewport-host desktop" style={ACCENT_STYLE} />;
}
