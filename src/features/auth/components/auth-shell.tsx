import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 lg:grid-cols-12">
        <aside className="relative overflow-hidden border-r border-rule bg-panel lg:col-span-5">
          <div className="flex h-full flex-col justify-between p-8 sm:p-10">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-semibold text-white">
                M
              </span>
              <span className="text-sm font-semibold tracking-tight">Mini Jira</span>
            </Link>

            <div className="max-w-sm py-12">
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                Work in view.
              </h1>
              <p className="mt-5 text-sm leading-6 text-ink-soft">
                A compact kanban board for small teams that want to see
                everything at once — what is next, what is in progress, and what
                is done.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-6 border-t border-rule pt-6">
                <div>
                  <p className="text-2xl font-semibold">3</p>
                  <p className="mt-0.5 text-xs text-ink-faint">lanes</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">1</p>
                  <p className="mt-0.5 text-xs text-ink-faint">board</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">All</p>
                  <p className="mt-0.5 text-xs text-ink-faint">work shown</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-ink-faint">
              Workspaces · Projects · Kanban · Comments
            </p>
          </div>
        </aside>

        <section className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-7">
          <div className="mx-auto w-full max-w-sm">
            <Link
              href="/"
              className="mb-8 flex items-center justify-center gap-2 lg:hidden"
            >
              <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-semibold text-white">
                M
              </span>
              <span className="text-sm font-semibold tracking-tight">Mini Jira</span>
            </Link>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

interface AuthShellProps {
  children: ReactNode;
}