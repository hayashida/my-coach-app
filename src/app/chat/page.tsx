import { LogoutButton } from "@/components/auth/logout-button";

export default function ChatPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-end p-4 border-b">
        <LogoutButton />
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">チャット機能は準備中です</p>
      </main>
    </div>
  );
}
