"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * Click-to-load video: no third-party request (and no cookies) until the reader
 * asks for it. Uses youtube-nocookie.com once activated.
 */
export function ConsentEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [active, setActive] = useState(false);
  return (
    <figure className="embed">
      <div className="embed-frame">
        {active ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="embed-placeholder" onClick={() => setActive(true)}>
            <Play aria-hidden="true" size={22} />
            <span>Load video: {title}</span>
            <small>Loads content from YouTube, which may set cookies.</small>
          </button>
        )}
      </div>
    </figure>
  );
}
