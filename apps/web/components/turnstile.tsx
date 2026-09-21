"use client";
import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
export default function Turnstile({
  action,
  onToken,
  onError,
}: {
  action: string;
  onToken: (token: string) => void;
  onError: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };
  useEffect(() => {
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!sitekey) return;
    let widget: string | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const render = () => {
      if (!cancelled && ref.current && window.turnstile && !widget) {
        widget = window.turnstile.render(ref.current, {
          sitekey,
          action,
          callback: (token) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(""),
          "error-callback": () => callbacks.current.onError(),
        });
        if (timer) clearInterval(timer);
      }
    };
    if (!document.getElementById("turnstile-script")) {
      const script = document.createElement("script");
      script.id = "turnstile-script";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onerror = () => callbacks.current.onError();
      script.onload = render;
      document.head.append(script);
    }
    render();
    timer = setInterval(render, 300);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (widget) window.turnstile?.remove(widget);
    };
  }, [action]);
  return <div ref={ref} className="turnstile-container" />;
}
