import { cn } from '@/lib/utils';

export interface AppLogoProps {
  className?: string;
  title?: string;
}

export function AppLogo({ className, title = 'TSNet-TS' }: AppLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="10" fill="#1a1f2e" />
      <g
        transform="translate(8 8) scale(0.6666667)"
        fill="none"
        stroke="#fafafa"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12q2.5 2 5 0t5 0 5 0 5 0" />
        <path d="M2 19q2.5 2 5 0t5 0 5 0 5 0" />
        <path d="M2 5q2.5 2 5 0t5 0 5 0 5 0" />
      </g>
    </svg>
  );
}
