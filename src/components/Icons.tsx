import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({
  size = 20,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconPulse(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h4l2.5-4.5 4 9 2.5-4.5H21" />
      <circle cx="3" cy="12" r="1.5" />
      <circle cx="21" cy="12" r="1.5" />
    </IconBase>
  );
}

export function IconChart(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 18V6" />
      <path d="M8 18V10" />
      <path d="M12 18V8" />
      <path d="M16 18V4" />
      <path d="M20 18V12" />
    </IconBase>
  );
}

export function IconBell(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 16H6l1.5-2V10a4.5 4.5 0 0 1 9 0v4L18 16Z" />
      <path d="M9 18a3 3 0 0 0 6 0" />
    </IconBase>
  );
}

export function IconStack(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 16l9 5 9-5" />
    </IconBase>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2l2.2 4.8L19 9l-4.8 2.2L12 16l-2.2-4.8L5 9l4.8-2.2L12 2Z" />
      <path d="M5 18h6" />
      <path d="M13 18h6" />
    </IconBase>
  );
}

export function IconRadar(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12L19 5" />
      <path d="M12 4v8" />
      <path d="M12 12h8" />
    </IconBase>
  );
}

export function IconSBP(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="12" cy="6" r="2.2" />
      <circle cx="18" cy="12" r="2.2" />
      <path d="M7.6 10.9 10.6 8.4" />
      <path d="M13.4 8.4 16.4 10.9" />
      <path d="M8 14.5h8" />
    </IconBase>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconBase>
  );
}

export function IconClose(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </IconBase>
  );
}

export function IconSun(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.5" />
      <path d="M12 19.5V22" />
      <path d="M2 12h2.5" />
      <path d="M19.5 12H22" />
      <path d="m4.9 4.9 1.7 1.7" />
      <path d="m17.4 17.4 1.7 1.7" />
      <path d="m19.1 4.9-1.7 1.7" />
      <path d="m6.6 17.4-1.7 1.7" />
    </IconBase>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 14.4A8 8 0 1 1 9.6 4 6.8 6.8 0 0 0 20 14.4Z" />
    </IconBase>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </IconBase>
  );
}
