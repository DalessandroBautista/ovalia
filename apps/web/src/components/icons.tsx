import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;
}

export function RugbyBallIcon(props: IconProps) {
  return <Icon {...props}><path d="M4.1 17.9c-2.7-2.7-.9-8.8 3.7-13.4s10.7-6.4 13.4-3.7.9 8.8-3.7 13.4-10.7 6.4-13.4 3.7Z" transform="translate(-.7 2.7)" /><path d="m8.6 15.4 6.8-6.8M10 10l4 4M11.8 8.2l4 4" /></Icon>;
}

export function ArrowLeftIcon(props: IconProps) { return <Icon {...props}><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></Icon>; }
export function ArrowRightIcon(props: IconProps) { return <Icon {...props}><path d="m9 18 6-6-6-6" /><path d="M4 12h11" /></Icon>; }
export function SearchIcon(props: IconProps) { return <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>; }
export function HomeIcon(props: IconProps) { return <Icon {...props}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></Icon>; }
export function ClockIcon(props: IconProps) { return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>; }
export function TargetIcon(props: IconProps) { return <Icon {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v2M21 12h-2M12 21v-2M3 12h2" /></Icon>; }
export function DiamondIcon(props: IconProps) { return <Icon {...props}><path d="m12 3 8 9-8 9-8-9 8-9Z" /><path d="m8 12 4-5 4 5-4 5-4-5Z" /></Icon>; }
export function UserIcon(props: IconProps) { return <Icon {...props}><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.8-4.1 3.3-6 7.5-6s6.7 1.9 7.5 6" /></Icon>; }
