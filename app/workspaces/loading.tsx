export default function WorkspacesLoading() {
  return (
    <div className="min-h-screen bg-paper px-4 py-10 animate-pulse">
      <section className="mx-auto w-full max-w-3xl">
        <div className="text-center">
          <div className="mx-auto size-12 rounded-2xl bg-rule-strong/40" />
          <div className="mx-auto mt-4 h-7 w-52 rounded-md bg-rule-strong/50" />
          <div className="mx-auto mt-3 h-4 w-72 rounded-md bg-rule-strong/30" />
        </div>

        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-rule bg-panel p-4 shadow-2xs"
            >
              <div className="size-10 shrink-0 rounded-lg bg-rule-strong/40" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-rule-strong/40" />
                <div className="h-3 w-56 max-w-full rounded bg-rule-strong/20" />
              </div>
              <div className="h-8 w-16 shrink-0 rounded-lg bg-rule-strong/30" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
