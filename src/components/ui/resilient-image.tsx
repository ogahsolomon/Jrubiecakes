"use client";

import Image from "next/image";
import { useState } from "react";

type ResilientImageProps = {
  src?: string | null;
  alt: string;
  /** Required when the image sits inside a relatively-positioned frame. */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  unoptimized?: boolean;
  referrerPolicy?: React.ComponentProps<typeof Image>["referrerPolicy"];
  fallbackEmoji?: string;
  fallbackLabel?: string;
};

/**
 * An image that never shows a broken-image icon.
 *
 * Product photos come from the database and from admin-supplied URLs, so any of
 * them can 404, be deleted, or fail the hostname allow-list in next.config.
 * When that happens (or when there is no URL at all) we swap in a soft branded
 * panel so the layout stays intact and the page still reads as intentional.
 */
export function ResilientImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  priority,
  className,
  unoptimized,
  referrerPolicy,
  fallbackEmoji = "🎂",
  fallbackLabel,
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  const usable = typeof src === "string" && src.trim() !== "";

  if (!usable || failed) {
    return (
      <div
        className={
          fill
            ? "image-fallback absolute inset-0"
            : "image-fallback aspect-square w-full"
        }
        role="img"
        aria-label={alt}
      >
        <span aria-hidden="true" className="text-3xl opacity-70 sm:text-4xl">
          {fallbackEmoji}
        </span>
        {fallbackLabel ? (
          <span className="absolute bottom-2 left-1/2 w-full -translate-x-1/2 px-2 text-center text-[10px] font-medium uppercase tracking-wide text-cocoa-500">
            {fallbackLabel}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={className}
      unoptimized={unoptimized}
      referrerPolicy={referrerPolicy}
      onError={() => setFailed(true)}
    />
  );
}