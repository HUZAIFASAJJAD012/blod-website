"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Lightbox built on the native <dialog> element: focus-trapped, Esc to close. */
export function ZoomableImage({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === d) d.close();
    };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button type="button" className="zoom-trigger" onClick={() => ref.current?.showModal()} aria-label={`Enlarge image: ${alt || "screenshot"}`}>
        <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1024px) 730px, 100vw" loading="lazy" />
      </button>
      <dialog ref={ref} className="lightbox" aria-label={alt || "Image"}>
        <button type="button" className="lightbox-close" onClick={() => ref.current?.close()} aria-label="Close image">
          <X size={20} aria-hidden="true" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution view, loaded on demand */}
        <img src={src} alt={alt} width={width} height={height} loading="lazy" />
      </dialog>
    </>
  );
}
