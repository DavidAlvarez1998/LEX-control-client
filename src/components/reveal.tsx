"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Revela su contenido al entrar en viewport (fade + slide-up), una sola vez.
 * `delay` (ms) permite escalonar (stagger) una grilla de tarjetas. Las clases de
 * animación viven en globals.css (.lex-reveal/.in) y respetan prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`lex-reveal ${visible ? "in" : ""} ${className}`}>
      {children}
    </div>
  );
}
