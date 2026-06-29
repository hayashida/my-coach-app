'use client';

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";
import { clearSessionStorage } from "@/hooks/use-session-storage";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    clearSessionStorage();
    startTransition(() => { signOutAction(); });
  };

  return (
    <Button variant="outline" onClick={handleLogout} disabled={isPending}>
      ログアウト
    </Button>
  );
}
