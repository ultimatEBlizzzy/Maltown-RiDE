import { NextRequest } from "next/server";
import { clientIp, handle, rateLimit } from "@/lib/http";

export const dynamic = "force-dynamic";

interface CommonsPage {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

function plainText(value = ""): string {
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&quot;/g, "").trim();
}

function wikimediaUrl(value: string | undefined, allowThumbs = false): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hosts = allowThumbs ? ["thumb.wikimedia.org", "upload.wikimedia.org"] : ["commons.wikimedia.org"];
    return url.protocol === "https:" && hosts.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Return an appropriately licensed Commons photo for the selected vehicle model. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    rateLimit(`vehicle-image:${clientIp(req)}`, 30, 30);
    const make = req.nextUrl.searchParams.get("make")?.trim() ?? "";
    const model = req.nextUrl.searchParams.get("model")?.trim() ?? "";
    if (!make || !model || make.length > 60 || model.length > 60) {
      return Response.json({ error: { message: "A valid make and model are required", code: "VALIDATION" } }, { status: 400 });
    }

    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `filetype:bitmap ${make} ${model}`,
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "480",
      format: "json",
      origin: "*",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "MALTownRiDE/1.0 (vehicle preview; https://maltown-ride.onrender.com)" },
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error(`Wikimedia Commons responded ${response.status}`);

    const data = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    const candidates = Object.values(data.query?.pages ?? []);
    for (const page of candidates) {
      const image = page.imageinfo?.[0];
      const metadata = image?.extmetadata;
      const license = metadata?.LicenseShortName?.value ?? "";
      const imageUrl = wikimediaUrl(image?.thumburl, true);
      const sourceUrl = wikimediaUrl(image?.descriptionurl);
      if (!imageUrl || !sourceUrl) continue;
      if (!/CC BY(?:-SA)?(?:\s|$)|CC0|Public domain/i.test(license)) continue;
      const reportedLicenseUrl = metadata?.LicenseUrl?.value;
      const licenseUrl = reportedLicenseUrl?.startsWith("https://creativecommons.org/licenses/")
        ? reportedLicenseUrl
        : sourceUrl;

      return Response.json({
        image: {
          url: imageUrl,
          sourceUrl,
          title: plainText(page.title?.replace(/^File:/, "")),
          artist: plainText(metadata?.Artist?.value || metadata?.Credit?.value || "Wikimedia Commons contributor"),
          license,
          licenseUrl,
        },
      });
    }
    return Response.json({ image: null });
  });
}