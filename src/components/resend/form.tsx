"use client";

import { useState } from "react";
import Section from "../common/section";

export default function ResendEmailForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsLoading(true);
    setSuccess(false);
    setError(false);

    console.log(`Sending email to "${name} <${email}>"`);

    const response = await fetch("/api/send", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Email sent successfully. Response: ", data);
      setSuccess(true);
    } else {
      console.error("Failed to send email. Response: ", data);
      if (data?.error?.message) {
        window.alert(`Error sending email:\n\n${data.error.message}`);
      }
      setError(true);
    }

    setIsLoading(false);
    setTimeout(() => {
      setSuccess(false);
      setError(false);
    }, 3000);
  };

  return (
    <Section title={<span data-lingo-skip>Resend</span>}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row gap-4 w-full"
      >
        <input
          type="text"
          placeholder="Name"
          required
          className="border border-gray-300 rounded-md p-2 flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
        />
        <input
          type="email"
          placeholder="Email"
          required
          className="border border-gray-300 rounded-md p-2 flex-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`${isLoading ? "cursor-progress opacity-50" : ""} bg-primary text-white px-4 py-2 rounded-md cursor-pointer hover:bg-primary/80 transition-colors`}
        >
          {isLoading ? <span>Sending...</span> : <span>Send email</span>}
          {success && " ✅"}
          {error && " ❌"}
        </button>
      </form>
    </Section>
  );
}
