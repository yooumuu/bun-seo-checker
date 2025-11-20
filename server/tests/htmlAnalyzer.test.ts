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
    <a class="cta desktop-link" data-viewport="desktop" href="/internal?utm_source=newsletter&utm_campaign=test">Internal tracked</a>
    <a class="cta mobile-only" data-viewport="mobile" href="/internal-two">Internal missing</a>
    <a href="https://external.com/page">External</a>
  </body>
</html>
`;

const responsiveHtml = `
<!doctype html>
<html>
  <body>
    <a class="desktop-cta" data-viewport="desktop" href="/cta?utm_source=desktop">Desktop CTA</a>
    <a class="mobile-cta" data-device="mobile" href="/cta?utm_source=mobile">Mobile CTA</a>
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
        expect(links.utmSummary.examples[0]?.heading?.text).toBe("Heading");
        expect(links.utmSummary.examples[0]?.heading?.tag).toBe("h1");
        expect(links.utmSummary.examples[0]?.deviceVariant).toBe("desktop");
    });

    it("detects device variants for UTM links", () => {
        const links = analyzeLinks(responsiveHtml, "https://example.com");
        const desktop = links.utmSummary.examples.find((example) =>
            example.url.includes("desktop")
        );
        const mobile = links.utmSummary.examples.find((example) =>
            example.url.includes("mobile")
        );
        expect(desktop?.deviceVariant).toBe("desktop");
        expect(mobile?.deviceVariant).toBe("mobile");
    });

    it("detects tracking snippets and events", () => {
        const script = `
        <script>
            window?.mixpanel?.track("newsletter_subscription");
            gtag('event', 'cta_click');
            dataLayer.push({ event: 'form_submit' });
        </script>`;
        const tracking = analyzeTracking(script);
        expect(tracking.some((event) => event.platform === "mixpanel")).toBe(
            true
        );
        const mixpanelEvent = tracking.find(
            (event) => event.platform === "mixpanel"
        );
        expect(mixpanelEvent?.eventName).toBe("newsletter_subscription");
        const gaEvents = tracking.filter((event) => event.platform === "ga");
        expect(gaEvents.length).toBeGreaterThanOrEqual(2);
        expect(
            gaEvents.some((event) => event.eventName === "cta_click")
        ).toBe(true);
        expect(
            gaEvents.some((event) => event.eventName === "form_submit")
        ).toBe(true);
    });

    it("summarizes issues for missing metadata", () => {
        const seo = analyzeSeo(missingHtml);
        const links = analyzeLinks(missingHtml, "https://example.com");
        const tracking = analyzeTracking(missingHtml);
        const summary = buildIssueSummary(seo, links, tracking);

        expect(summary.seo.missingTitle).toBe(true);
        expect(summary.seo.missingDescription).toBe(true);
        expect(summary.links.utmMissing).toBe(1); // missingHtml has 1 internal link without UTM
        expect(summary.tracking.mixpanelMissing).toBe(true);
        expect(summary.totals.seoIssues).toBeGreaterThan(0);
        expect(summary.meta.seoScore).toBeGreaterThanOrEqual(0);
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
        expect(aggregated.scorecard.seoAverageScore).toBeGreaterThan(0);
        expect(aggregated.scorecard.utmCoveragePercent).toBeGreaterThanOrEqual(0);
        expect(aggregated.scorecard.trackingCoverage.mixpanel).toBeGreaterThanOrEqual(
            0
        );
        expect(aggregated.pagesAnalysed).toBe(2);
    });
});
