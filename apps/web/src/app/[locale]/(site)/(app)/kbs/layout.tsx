export default async function KbsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
