import type { CSSProperties, ReactNode } from "react";
// Warm wooden floor, like the office
export const floorStyle: CSSProperties = {
  backgroundColor: "#e8d4b2",
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(120,85,40,0.10) 0 1px, transparent 1px 56px)," +
    "repeating-linear-gradient(90deg, rgba(120,85,40,0.05) 0 1px, transparent 1px 220px)",
};

// Shared classes so the buttons look the same on every page
export const btnPrimary =
  "bg-[#5468d4] hover:bg-[#4355b8] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors shadow-sm";
export const btnText =
  "text-sm font-medium text-[#4355b8] hover:bg-[#e6e9fb] px-3 py-2 rounded-full transition-colors";
export const checkboxClass = "w-4 h-4 accent-[#5468d4]";

export function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3z" />
    </svg>
  );
}
// Green success / red error box under the form
export function FormMessage({ message, isError }: { message: string; isError: boolean }) {
  if (!message) return null;
  return (
    <div
      className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${
        isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      <span>{isError ? "⚠" : "✓"}</span>
      {message}
    </div>
  );
}
// Text field with a label that floats up when you type
export function FloatingInput({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        required
        className="peer w-full rounded-xl border border-[#d8cdbd] bg-white px-4 pt-4 pb-3 text-base text-[#2b2620] outline-none transition
                   focus:border-2 focus:border-[#5468d4]"
      />
      <label
        htmlFor={id}
        className="absolute left-3 px-1 bg-white text-[#8a8073] pointer-events-none transition-all
                   top-1/2 -translate-y-1/2 text-base
                   peer-focus:top-0 peer-focus:text-xs peer-focus:text-[#4355b8]
                   peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs"
      >
        {label}
      </label>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10" style={floorStyle}>
      <div className="w-full max-w-4xl rounded-[28px] bg-white/95 border border-black/5 shadow-[0_12px_40px_rgba(70,50,20,0.18)] p-8 md:p-12 grid md:grid-cols-2 gap-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-[#1f2b2a] flex items-center justify-center">
              {icon ?? <PulseIcon />}
            </div>
            <span className="text-lg font-semibold text-[#2b2620]">Dev Pulse</span>
          </div>

          <h1 className="text-[34px] leading-tight font-semibold text-[#2b2620]">{title}</h1>
          <p className="mt-3 text-[#6b6257]">{subtitle}</p>
        </div>

        <div className="md:pt-16">{children}</div>
      </div>
    </main>
  );
}