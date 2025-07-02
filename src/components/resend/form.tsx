"use client";

import { useState } from "react";
import Section from "../common/section";

export default function ResendEmailForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    console.log(`Sending email to "${name} <${email}>"`);

    const response = await fetch("/api/send", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Email sent successfully. Response: ", data);
    } else {
      console.error("Failed to send email. Response: ", data);
      if (data?.error?.message) {
        window.alert(`Error sending email:\n\n${data.error.message}`);
      }
    }

    setIsLoading(false);
  };

  return (
    <Section as="form" title="Resend" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Name"
        required
        className="border border-gray-300 rounded-md p-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isLoading}
      />
      <input
        type="email"
        placeholder="Email"
        required
        className="border border-gray-300 rounded-md p-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading}
        className={`${isLoading ? "cursor-progress opacity-50" : ""} bg-primary text-white px-4 py-2 rounded-md`}
      >
        {isLoading ? <span>Sending...</span> : <span>Send email</span>}
      </button>
    </Section>
  );
}
