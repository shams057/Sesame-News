import { useCallback, useEffect, useRef, useState } from "react";
import "./MediaCard.css";

/* ---------- Icons (inline SVG, no dependencies) ---------- */

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" />
    <path d="M10 13 21 3" />
  </svg>
);

const VerifiedIcon = () => (
  <svg className="mc-verified" viewBox="0 0 24 24" width="16" height="16" aria-label="Verified">
    <path fill="currentColor"
      d="M12 1.5 14.6 3l3-.1 1.5 2.6 2.6 1.5-.1 3L23 12l-1.4 2.6.1 3-2.6 1.5-1.5 2.6-3-.1L12 22.5 9.4 21l-3 .1-1.5-2.6-2.6-1.5.1-3L1 12l1.4-2.6-.1-3 2.6-1.5 1.5-2.6 3 .1L12 1.5Z" />
    <path d="m8 12.3 2.8 2.8L16.3 9.5" fill="none" stroke="#fff" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
);

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 5-7 7 7 7" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 5 7 7-7 7" />
  </svg>
);

/* ---------- Helpers ---------- */

async function downloadMedia(item) {
  const fallbackName = item.src.split("/").pop().split("?")[0] || "media";
  const filename = item.filename || fallbackName;
  try {
    const res = await fetch(item.src);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    URL.revokeObjectURL(url);
  } catch {
    // Cross-origin without CORS: fall back to a direct link
    triggerDownload(item.src, filename);
  }
}

function triggerDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- Component ----------
 * media: [{ type: "image" | "video", src, alt?, filename?, poster? }]
 * width / height: strict pixel size of the media frame
 */

export default function MediaCard({
  username,
  avatarSrc,
  verified = false,
  timeAgo,
  caption,
  media = [],
  width = 468,
  height = 520,
  sharing = false,
  onShare,
  // Reserved for the upcoming bookmark feature.
  // When provided, a bookmark button renders at the end of the action row.
  onBookmark,
}) {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const count = media.length;
  const current = media[index];

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIndex((i) => Math.min(count - 1, i + 1)), [count]);

  // Close menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleDownload = async () => {
    setMenuOpen(false);
    if (current) await downloadMedia(current);
  };

  return (
    <article className="mc" style={{ width }}>
      {/* Header */}
      <header className="mc-header">
        <div className="mc-avatar">
          {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{username?.[0]?.toUpperCase()}</span>}
        </div>

        <div className="mc-meta">
          <span className="mc-username">{username}</span>
          {verified && <VerifiedIcon />}
          {timeAgo && <span className="mc-time">• {timeAgo}</span>}
        </div>

        <div className="mc-menu" ref={menuRef}>
          <button
            type="button"
            className="mc-icon-btn"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreIcon />
          </button>

          {menuOpen && (
            <div className="mc-popover" role="menu">
              <button type="button" role="menuitem" className="mc-popover-item" onClick={handleDownload}>
                <DownloadIcon />
                Download media
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Media frame: strict width + height */}
      <div className="mc-frame" style={{ width, height }}>
        {current?.type === "video" ? (
          <video
            key={current.src}
            className="mc-media"
            src={current.src}
            poster={current.poster}
            controls
            playsInline
          />
        ) : current ? (
          <img key={current.src} className="mc-media" src={current.src} alt={current.alt || ""} draggable={false} />
        ) : null}

        {index > 0 && (
          <button type="button" className="mc-nav mc-nav-prev" aria-label="Previous" onClick={prev}>
            <ChevronLeft />
          </button>
        )}
        {index < count - 1 && (
          <button type="button" className="mc-nav mc-nav-next" aria-label="Next" onClick={next}>
            <ChevronRight />
          </button>
        )}
      </div>

      {/* Pagination dots */}
      {count > 1 && (
        <div className="mc-dots" role="tablist" aria-label="Media">
          {media.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Media ${i + 1} of ${count}`}
              className={`mc-dot${i === index ? " is-active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mc-actions">
        <button type="button" className="mc-icon-btn" aria-label="Share" onClick={() => onShare?.(current)} disabled={sharing}>
          {sharing ? <span className="mc-sharing" aria-hidden="true" /> : <ShareIcon />}
        </button>

        {/* Bookmark slot: wired later via the onBookmark prop */}
        {onBookmark && <span className="mc-actions-end" />}
      </div>

      {/* Caption */}
      {caption && (
        <p className="mc-caption">
          <strong>{username}</strong>
          {verified && <VerifiedIcon />}
          <span>{caption}</span>
        </p>
      )}
    </article>
  );
}
