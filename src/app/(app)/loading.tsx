export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Loading">
      <div className="h-24 animate-pulse border-b border-zinc-900 bg-zinc-950" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 animate-pulse border border-zinc-900 bg-zinc-950" />
        ))}
      </div>
    </div>
  );
}
