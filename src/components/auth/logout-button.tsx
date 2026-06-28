import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">ログアウト</Button>
    </form>
  );
}
