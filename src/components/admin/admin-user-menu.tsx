import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { getAdmin } from "@/modules/auth/guards";

/** Reads the session, so it must render inside a Suspense boundary. */
export async function AdminUserMenu() {
  const admin = await getAdmin();
  if (!admin) return null;
  return (
    <div className="flex items-center gap-2">
      {admin.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={admin.image} alt="" className="size-7 rounded-full border" />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {admin.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate text-sm max-md:sr-only">{admin.name}</span>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out">
          <LogOut />
        </Button>
      </form>
    </div>
  );
}
