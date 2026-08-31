/**
 * Единый набор SVG-иконок (заменяет эмодзи).
 * Все иконки наследуют currentColor и размер через props.
 */
import * as React from "react";

type P = React.SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...p }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...p,
  };
}

export const IconSword = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
    <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
  </svg>
);
export const IconRocket = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconWrench = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a4 4 0 0 0 5 5l-9 9a2.8 2.8 0 1 1-4-4l9-9a4 4 0 0 0-1 -1Z" />
  </svg>
);
export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 3v18h18" />
    <path d="M7 15l3-4 3 3 5-7" />
  </svg>
);
export const IconKey = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 8.5-8.5M17 6l2.5 2.5M14.5 8.5 17 11" />
  </svg>
);
export const IconChat = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.6 9.6 0 0 1-4-1L3 21l2-4.5A8.38 8.38 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5Z" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" />
  </svg>
);
export const IconGift = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
export const IconServer = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="20" height="8" rx="2" />
    <rect x="2" y="13" width="20" height="8" rx="2" />
    <path d="M6 7h.01M6 17h.01" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconTelegram = ({ size = 20, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M21.9 4.3 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L6.9 12.9 2.4 11.5c-1-.3-1-1 .2-1.4l18-6.9c.8-.3 1.5.2 1.3 1.1Z" />
  </svg>
);
export const IconDiscord = ({ size = 20, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.3 4.9A19.8 19.8 0 0 0 15.4 3.4l-.2.5c1.6.4 2.9 1 4.1 1.8a13.9 13.9 0 0 0-10.6 0c1.2-.8 2.6-1.4 4.1-1.8l-.2-.5A19.8 19.8 0 0 0 3.7 4.9C1.1 8.8.4 12.6.8 16.4a20 20 0 0 0 6 3l1.2-1.7c-1-.4-1.9-.8-2.7-1.4l.6-.4a14.2 14.2 0 0 0 12.2 0l.6.4c-.8.6-1.7 1-2.7 1.4l1.2 1.7a20 20 0 0 0 6-3c.5-4.4-.7-8.2-3-11.5ZM8.5 14.2c-1.2 0-2.1-1.1-2.1-2.4 0-1.3.9-2.4 2.1-2.4s2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4 0-1.3.9-2.4 2.1-2.4s2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 13 4 4L19 7" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const IconCard = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
export const IconNews = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4h13v16H5a1 1 0 0 1-1-1V4Z" />
    <path d="M17 8h3v10a2 2 0 0 1-3 1.7M7 8h7M7 12h7M7 16h4" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

/** Официальная «галочка» верификации: залитый бейдж-звезда + белая птичка. */
export function VerifiedBadge({
  role,
  size = 18,
  title,
}: {
  role: string;
  size?: number;
  title?: string;
}) {
  if (role !== "ADMIN" && role !== "MODERATOR") return null;
  const isAdmin = role === "ADMIN";
  const gid = isAdmin ? "vb-admin" : "vb-mod";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="inline-block shrink-0 align-[-0.15em]"
      role="img"
      aria-label={title || (isAdmin ? "Администратор" : "Модератор")}
    >
      <title>{title || (isAdmin ? "Администратор" : "Модератор")}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          {isAdmin ? (
            <>
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="55%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#3b82f6" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </>
          )}
        </linearGradient>
      </defs>
      {/* зубчатый бейдж как в соцсетях */}
      <path
        fill={`url(#${gid})`}
        d="M12 1.6l2.35 1.7 2.87-.3 1.13 2.66 2.6 1.24-.62 2.83L22 12l-1.67 2.27.62 2.83-2.6 1.24-1.13 2.66-2.87-.3L12 22.4l-2.35-1.7-2.87.3-1.13-2.66-2.6-1.24.62-2.83L2 12l1.67-2.27-.62-2.83 2.6-1.24 1.13-2.66 2.87.3z"
      />
      <path
        d="m8.2 12.3 2.5 2.5 5.1-5.3"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Имя пользователя с цветом роли и галочкой. */
export function RoleName({
  username,
  role,
  size = 16,
  className = "",
}: {
  username: string;
  role: string;
  size?: number;
  className?: string;
}) {
  const cls =
    role === "ADMIN"
      ? "text-red-400 font-bold"
      : role === "MODERATOR"
        ? "text-blue-400 font-bold"
        : "text-zinc-300";
  return (
    <span className={`inline-flex items-center gap-1 ${cls} ${className}`}>
      {username}
      <VerifiedBadge role={role} size={size} />
    </span>
  );
}

/** Плашка роли. */
export function RoleBadge({ role }: { role: string }) {
  if (role === "ADMIN")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white bg-white/10">
        <VerifiedBadge role="ADMIN" size={13} /> ADMIN
      </span>
    );
  if (role === "MODERATOR")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white bg-blue-600">
        <VerifiedBadge role="MODERATOR" size={13} /> MODERATOR
      </span>
    );
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/10 text-white/60">
      USER
    </span>
  );
}
