import FirecrawlApp, { ScrapeResponse } from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

export async function POST(request: Request) {
  const { url } = await request.json();

  const validUrl = getValidUrl(url);
  if (!validUrl) {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const scrapeResult = (await firecrawl.scrapeUrl(validUrl, {
      formats: [],
      maxAge: 3600000, // 1 hour in milliseconds
    } as any)) as ScrapeResponse;

    if (!scrapeResult.success) {
      return Response.json({ error: scrapeResult.error }, { status: 500 });
    }

    return Response.json(scrapeResult);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}

function getValidUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch (error) {
    return false;
  }
}
