"use client";

import { FormEvent, useState } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = { type: "error" | "success"; text: string } | null;

/** Email sign-up with front-end validation only (nothing is sent anywhere). */
export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setStatus({ type: "error", text: "Please enter your email address." });
    } else if (!EMAIL_PATTERN.test(value)) {
      setStatus({ type: "error", text: "That doesn't look like a valid email address." });
    } else {
      setStatus({ type: "success", text: "Thanks! You're on the list." });
      setEmail("");
    }
  }

  return (
    <section className="newsletter" id="contact">
      <div className="container newsletter__inner">
        <div className="newsletter__text">
          <h2 className="section-title">Get race-week updates</h2>
          <p>Placeholder text: one short email before each race weekend. No spam, unsubscribe any time.</p>
        </div>

        <form className="newsletter__form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="email" className="sr-only">Email address</label>
          <div className="newsletter__row">
            <input
              type="email"
              id="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              className={status?.type === "error" ? "is-invalid" : ""}
              onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
            />
            <button type="submit" className="btn btn--primary">Subscribe</button>
          </div>
          <p className={`form-message ${status ? `is-${status.type}` : ""}`} role="status" aria-live="polite">
            {status?.text}
          </p>
        </form>
      </div>
    </section>
  );
}
