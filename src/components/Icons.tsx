import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.6v-6.2H9.6V21H5a1 1 0 0 1-1-1z" />
  </Svg>
);

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.2" cy="8.2" r="3.2" />
    <path d="M3.5 20c.4-3.4 2.7-5.4 5.7-5.4s5.3 2 5.7 5.4" />
    <path d="M15.8 5.4a3 3 0 0 1 0 5.8M17.5 14.9c2 .6 3.2 2.4 3.5 5.1" />
  </Svg>
);

export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.4h2.6l1.4-2.2h8l1.4 2.2H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.4a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.6" r="3.6" />
  </Svg>
);

export const ArchiveIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2" />
    <path d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.2" r="3.6" />
    <path d="M4.8 20.4c.5-3.8 3.3-6 7.2-6s6.7 2.2 7.2 6" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const CommentIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 11.6c0 4.2-3.8 7.4-8.5 7.4-1 0-2-.1-2.9-.4L4 20.5l1.1-3.4c-1-1.3-1.6-3-1.6-4.8C3.5 7.5 7.3 4.3 12 4.3s8.5 3.2 8.5 7.3Z" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15V4M8.2 7.3 12 3.5l3.8 3.8" />
    <path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12" />
  </Svg>
);

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s6.2-5.7 6.2-10.4A6.2 6.2 0 0 0 5.8 10.6C5.8 15.3 12 21 12 21Z" />
    <circle cx="12" cy="10.4" r="2.1" />
  </Svg>
);

export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4.5 4 7.5l3 3M4 7.5h13.5M17 19.5l3-3-3-3M20 16.5H6.5" />
  </Svg>
);

export const FlashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.2 2.8 5.4 13.4h5.2l-.8 7.8 7.8-10.6h-5.2z" />
  </Svg>
);

export const TimerIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="13.2" r="7.3" />
    <path d="M12 9.6v3.8l2.4 1.4M9.6 2.8h4.8" />
    <path d="M12 2.8v2.2" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 3.5 10.5 14M21 3.5l-6.8 17-3.7-6.5L4 10.3z" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.8a6 6 0 0 1 12 0c0 4.2 1.4 5.4 1.8 6H4.2c.4-.6 1.8-1.8 1.8-6Z" />
    <path d="M9.8 19a2.4 2.4 0 0 0 4.4 0" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9 7V4.8h6V7M6.5 7l.8 13h9.4l.8-13M10 11v5.5M14 11v5.5" />
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.8 12h16.4M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.4-3.6-8.5S9.6 6.1 12 3.5Z" />
  </Svg>
);

export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 14.5 14.5 9.5M7.8 17.8l-1.3 1.3a3.8 3.8 0 0 1-5.3-5.3l3.2-3.2a3.8 3.8 0 0 1 5.3 0M16.2 6.2l1.3-1.3a3.8 3.8 0 0 1 5.3 5.3l-3.2 3.2a3.8 3.8 0 0 1-5.3 0" transform="translate(-1 -1)" />
  </Svg>
);

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h8M17 8.2l3.8 3.8-3.8 3.8M20.8 12H10" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17 4.6-4.6 3.4 3.4 2.2-2.2 4.8 4.8" />
  </Svg>
);
