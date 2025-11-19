import { describe, expect, it } from "bun:test";
import {
    aggregateSummaries,
    analyzeLinks,
    analyzeSeo,
    analyzeTracking,
    buildIssueSummary,
} from "../lib/analyzers/html";

const sampleHtml = `
<!doctype html>
<html>
  <head>
    <title>Sample Page</title>
    <meta name="description" content="A demo description" />
    <link rel="canonical" href="https://example.com/page" />
    <script type="application/ld+json">
      { "name": "Demo", "type": "WebSite" }
    </script>
    <script>
      mixpanel.track("Clicked");
      gtag('config', 'UA-123');
    </script>
  </head>
  <body>
    <h1>Heading</h1>
    <a href="/internal?utm_source=newsletter&utm_campaign=test">Internal tracked</a>
    <a href="/internal-two">Internal missing</a>
    <a href="https://external.com/page">External</a>
  </body>
</html>
`;

const missingHtml = `
<!doctype html>
<html>
  <body>
    <a href="/page-one">First</a>
  </body>
</html>
`;

describe("HTML analyzer helpers", () => {
    it("extracts SEO metadata", () => {
        const seo = analyzeSeo(sampleHtml);
        expect(seo.title).toBe("Sample Page");
        expect(seo.metaDescription).toBe("A demo description");
        expect(seo.canonical).toBe("https://example.com/page");
        expect(seo.h1).toBe("Heading");
        expect(seo.score).toBeGreaterThan(0);
    });

    it("measures link metrics", () => {
        const links = analyzeLinks(sampleHtml, "https://example.com");
        expect(links.internalLinks).toBe(2);
        expect(links.externalLinks).toBe(1);
        expect(links.utmSummary.trackedLinks).toBe(1);
        expect(links.utmSummary.missingUtm).toBe(1);
    });

    it("detects tracking snippets", () => {
        const tracking = analyzeTracking(sampleHtml);
        expect(tracking.length).toBe(2);
        expect(tracking[0]?.platform).toBe("mixpanel");
        expect(tracking[1]?.platform).toBe("ga");
    });

    it("summarizes issues for missing metadata", () => {
        const seo = analyzeSeo(missingHtml);
        const links = analyzeLinks(missingHtml, "https://example.com");
        const tracking = analyzeTracking(missingHtml);
        const summary = buildIssueSummary(seo, links, tracking);

        expect(summary.seo.missingTitle).toBe(true);
        expect(summary.seo.missingDescription).toBe(true);
        expect(summary.links.utmMissing).toBe(0);
        expect(summary.tracking.mixpanelMissing).toBe(true);
        expect(summary.totals.seoIssues).toBeGreaterThan(0);
    });

    it("aggregates summaries across pages", () => {
        const seoA = analyzeSeo(sampleHtml);
        const linksA = analyzeLinks(sampleHtml, "https://example.com");
        const trackingA = analyzeTracking(sampleHtml);
        const summaryA = buildIssueSummary(seoA, linksA, trackingA);

        const seoB = analyzeSeo(missingHtml);
        const linksB = analyzeLinks(missingHtml, "https://example.com");
        const trackingB = analyzeTracking(missingHtml);
        const summaryB = buildIssueSummary(seoB, linksB, trackingB);

        const aggregated = aggregateSummaries([summaryA, summaryB]);
        expect(aggregated.seo.missingTitle).toBe(1);
        expect(aggregated.links.internalLinks).toBeGreaterThan(0);
        expect(aggregated.tracking.mixpanelMissing).toBe(1);
    });
});
