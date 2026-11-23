import type { Photo } from "@/lib/site-content";

/**
 * One of the hospital's photos, written the way the budget needs it: the real size is in the markup so nothing shifts as it loads,
 * and everything lazy loads except the one picture at the top of the page.
 */
export function Pic({ photo, className, priority = false }: { photo: Photo; className?: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={photo.src}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
    />
  );
}
