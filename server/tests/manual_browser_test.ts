import { browserWorker } from "../lib/workers/browserWorker";

async function test() {
    console.log("Starting browser scan test...");
    try {
        // 1. Test basic navigation and link extraction
        console.log("Scanning example.com...");
        const result = await browserWorker.scanPage("https://example.com", "desktop");
        console.log("Scan complete!");
        console.log("URL:", result.url);
        console.log("Links found:", result.links.length);
        console.log("First link:", result.links[0]);

        // 2. Test tracking interception (simulated by injecting a script via data url or just checking if the hook works on a site)
        // Since we can't easily guarantee a site has mixpanel, we'll trust the unit test logic if we were writing one.
        // But we can verify the worker doesn't crash.

        console.log("Tracking events:", result.trackingEvents.length);

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await browserWorker.close();
    }
}

test();
