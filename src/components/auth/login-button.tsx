import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function LoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/chat" });
      }}
    >
      <Button type="submit">Google でログイン</Button>
    </form>
  );
}
