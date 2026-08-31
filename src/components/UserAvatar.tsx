import { avatarColor, avatarInitial } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type Props = {
  id?: string | null | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  imageUrl?: string | null | undefined;
  color?: string | null | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
};

const SIZES = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-sm",
  lg: "size-16 text-xl",
} as const;

export function UserAvatar({ id, name, email, imageUrl, color, size = "md", className }: Props) {
  const initial = avatarInitial(name, email);
  const background = avatarColor(id ?? email ?? name ?? "", color);
  const label = name || email || "User";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label}
        className={cn("rounded-full object-cover", SIZES[size], className)}
      />
    );
  }

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-primary-foreground",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: background }}
    >
      {initial}
    </span>
  );
}
