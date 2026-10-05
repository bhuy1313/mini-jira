import { redirect } from "next/navigation";

import { ThemeQuickToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "@/features/workspaces/components/user-menu";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { getUserWorkspaces } from "@/features/workspaces/queries";
import { getSessionUser } from "@/features/workspaces/session";

export default async function WorkspacesPage() {
  const [workspaces, user] = await Promise.all([
    getUserWorkspaces(),
    getSessionUser(),
  ]);

  if (workspaces.length === 1) {
    redirect(`/workspaces/${workspaces[0].id}`);
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
        <ThemeQuickToggle />
        <UserMenu
          userName={user?.name}
          userEmail={user?.email}
          userInitial={userInitial}
          variant="header"
        />
      </div>

      <section className="w-full max-w-3xl">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-lg font-bold text-primary-ink shadow-2xs border border-primary/20">
            M
          </span>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Your Workspaces
          </h1>
          <p className="mt-2 text-sm text-ink-soft max-w-md mx-auto">
            Select a workspace to jump right into your projects and tasks, or create a new workspace.
          </p>
        </div>
        <div className="mt-8">
          <WorkspaceSwitcher workspaces={workspaces} variant="block" />
        </div>
      </section>
    </main>
  );
}