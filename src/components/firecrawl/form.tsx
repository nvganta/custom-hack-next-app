"use client";

import { useState } from "react";
import type { ScrapeResponse } from "@mendable/firecrawl-js";

export default function FirecrawlForm({
  onScrape,
}: {
  onScrape: (data: ScrapeResponse) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [url, setUrl] = useState("https://lingo.dev");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    console.log(`Scraping ${url}`);

    const response = await fetch("/api/crawl", {
      method: "POST",
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Scraped successfully. Response: ", data);
      onScrape(data);
    } else {
      console.error("Failed to scrape. Response: ", data);
      if (data?.error) {
        const status = data.error?.statusCode
          ? `${data.error?.statusCode}:`
          : "";
        window.alert(`Scraping failed:\n\n${status}${data.error?.message}`);
      }
    }

    setIsLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col md:flex-row gap-4 w-full"
    >
      <input
        type="text"
        placeholder="URL"
        required
        className="border border-gray-300 rounded-md p-2 flex-1"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading}
        className={`${isLoading ? "cursor-progress opacity-50" : ""} bg-primary text-white px-4 py-2 rounded-md cursor-pointer`}
      >
        {isLoading ? <span>Scraping...</span> : <span>Scrape</span>}
      </button>
    </form>
  );
}
