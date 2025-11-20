import { browserWorker } from "../server/lib/workers/browserWorker";
import path from "path";

async function runTest() {
    const fixturePath = path.resolve(process.cwd(), "tests/fixtures/test-page.html");
    const url = `file://${fixturePath}`;

    console.log(`Scanning ${url}...`);

    try {
        const result = await browserWorker.scanPage(url, "desktop");

        console.log("Scan Result:");
        console.log("HTML Length:", result.html.length);
        console.log("Links:", JSON.stringify(result.links, null, 2));
        console.log("Tracking Events:", JSON.stringify(result.trackingEvents, null, 2));

        // Assertions
        const visibleLink = result.links.find(l => l.url.includes("utm_source=test"));
        const hiddenLink = result.links.find(l => l.url.includes("hidden"));

        if (!visibleLink || !visibleLink.visible) {
            console.error("FAIL: Visible link not found or marked invisible");
        } else {
            console.log("PASS: Visible link found");
        }

        if (hiddenLink && hiddenLink.visible) {
            console.error("FAIL: Hidden link marked visible");
        } else {
            console.log("PASS: Hidden link handled correctly (either not found or invisible)");
        }

        const pageViewEvent = result.trackingEvents.find(e => e.type === "track" && e.payload[0] === "Page View");
        if (pageViewEvent) {
            console.log("PASS: Page View event captured");
        } else {
            console.error("FAIL: Page View event not captured");
        }

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await browserWorker.close();
    }
}

runTest();
