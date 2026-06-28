import { LoginButton } from "@/components/auth/login-button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col items-center gap-8 rounded-2xl bg-white px-8 py-12 shadow-sm dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            my-coach-app
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            中学生の学習をサポートするチャットアプリです。
            <br />
            AIコーチがあなたの質問に丁寧に答えます。
          </p>
        </div>
        <LoginButton />
      </main>
    </div>
  );
}
