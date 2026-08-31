import arrowRight from "../assets/icons/arrow-right.svg";
import bookOpen from "../assets/icons/book-open.svg";
import calendarDays from "../assets/icons/calendar-days.svg";
import check from "../assets/icons/check.svg";
import chevronRight from "../assets/icons/chevron-right.svg";
import circleAlert from "../assets/icons/circle-alert.svg";
import fileText from "../assets/icons/file-text.svg";
import eye from "../assets/icons/eye.svg";
import house from "../assets/icons/house.svg";
import info from "../assets/icons/info.svg";
import clock from "../assets/icons/clock.svg";
import lock from "../assets/icons/lock.svg";
import monitor from "../assets/icons/monitor.svg";
import shieldCheck from "../assets/icons/shield-check.svg";
import sparkles from "../assets/icons/sparkles.svg";
import upload from "../assets/icons/upload.svg";
import userRound from "../assets/icons/user-round.svg";
import close from "../assets/icons/x.svg";

const iconSources = {
  arrowRight,
  bookOpen,
  calendarDays,
  check,
  chevronRight,
  circleAlert,
  clock,
  close,
  fileText,
  eye,
  house,
  info,
  lock,
  monitor,
  shieldCheck,
  sparkles,
  upload,
  userRound,
} as const;

export type IconName = keyof typeof iconSources;

export interface IconProps {
  readonly name: IconName;
  readonly label?: string;
  readonly size?: number;
  readonly className?: string;
}

export function Icon({ name, label, size = 20, className }: IconProps) {
  const source = iconSources[name];

  return (
    <img
      aria-hidden={label === undefined ? true : undefined}
      alt={label ?? ""}
      className={["ql-icon", className].filter(Boolean).join(" ")}
      height={size}
      role={label === undefined ? undefined : "img"}
      src={source}
      width={size}
    />
  );
}
