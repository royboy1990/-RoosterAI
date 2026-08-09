"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type TooltipSide = "top" | "bottom" | "left" | "right";

type Coords = {
  top: number;
  left: number;
};

function positionForSide(
  rect: DOMRect,
  side: TooltipSide,
  gap: number,
): { coords: Coords; transform: string } {
  const midX = rect.left + rect.width / 2;
  const midY = rect.top + rect.height / 2;

  switch (side) {
    case "bottom":
      return {
        coords: { top: rect.bottom + gap, left: midX },
        transform: "translate(-50%, 0)",
      };
    case "left":
      return {
        coords: { top: midY, left: rect.left - gap },
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        coords: { top: midY, left: rect.right + gap },
        transform: "translate(0, -50%)",
      };
    case "top":
    default:
      return {
        coords: { top: rect.top - gap, left: midX },
        transform: "translate(-50%, -100%)",
      };
  }
}

const caretClass: Record<TooltipSide, string> = {
  top: "bottom-0 left-1/2 -translate-x-1/2 translate-y-[45%]",
  bottom: "top-0 left-1/2 -translate-x-1/2 -translate-y-[45%]",
  left: "right-0 top-1/2 -translate-y-1/2 translate-x-[45%]",
  right: "left-0 top-1/2 -translate-y-1/2 -translate-x-[45%]",
};

/**
 * Lightweight hover/focus tooltip. Portals to `document.body` so it isn’t
 * clipped by overflow parents (e.g. the sticky header backdrop).
 *
 * @example
 * <Tooltip content="It's Cloudy in Tel Aviv" side="bottom">
 *   <button type="button">…</button>
 * </Tooltip>
 */
export function Tooltip({
  content,
  children,
  side = "top",
  delayMs = 160,
  className = "",
  contentClassName = "",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  delayMs?: number;
  /** Classes on the trigger wrapper. */
  className?: string;
  /** Classes on the tooltip panel. */
  contentClassName?: string;
}) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState<{
    coords: Coords;
    transform: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function clearShowTimer(): void {
    if (showTimerRef.current !== undefined) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = undefined;
    }
  }

  function updatePlacement(): void {
    const el = triggerRef.current;
    if (!el) return;
    setPlacement(positionForSide(el.getBoundingClientRect(), side, 8));
  }

  function show(): void {
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      updatePlacement();
      setOpen(true);
    }, delayMs);
  }

  function hide(): void {
    clearShowTimer();
    setOpen(false);
  }

  useEffect(() => {
    return () => clearShowTimer();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onReposition = (): void => {
      updatePlacement();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") hide();
    };

    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("keydown", onKeyDown);
    };
    // Placement reads `side` from closure; sync when open/side change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, side]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex ${className}`.trim()}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>
      {mounted && open && placement
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-50 max-w-xs"
              style={{
                top: placement.coords.top,
                left: placement.coords.left,
                transform: placement.transform,
              }}
            >
              <span
                className={[
                  "ui-tooltip-panel relative block rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-[0_10px_28px_rgba(0,0,0,0.45)]",
                  contentClassName,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {content}
                <span
                  aria-hidden
                  className={`absolute size-1.5 rotate-45 bg-surface-raised shadow-[0_0_0_1px_var(--border)] ${caretClass[side]}`}
                />
              </span>
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
