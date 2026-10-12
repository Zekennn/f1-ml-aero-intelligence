import Media from "../Media";
import type { Race } from "@/lib/calendar";

/**
 * Track photo from /public/images/tracks/<slug>.jpg.
 * With no photo (or a broken one) it shows a light ash "Track image" box.
 */
export default function TrackImage({ race, size }: { race: Race; size: "thumb" | "medium" }) {
  const className = `track-image track-image--${size}`;

  if (!race.image) {
    return <div className={`media is-missing ${className}`} data-label="Track image" role="img" aria-label="No track image yet" />;
  }
  return (
    <Media
      src={race.image}
      alt={`${race.circuit ?? race.name}`}
      label="Track image"
      className={className}
      sizes={size === "thumb" ? "120px" : "(max-width: 640px) 100vw, 640px"}
    />
  );
}
