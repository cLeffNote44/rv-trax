export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1a120b] via-[#2a1a0f] to-[#0f0a06]">
      {children}
    </div>
  );
}
