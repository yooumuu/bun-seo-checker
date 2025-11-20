import { chromium, type Browser } from "playwright";

export type DeviceProfile = "desktop" | "tablet" | "mobile";

export interface BrowserScanResult {
    deviceVariant: DeviceProfile;
    url: string;
    html: string;
    links: Array<{
        url: string;
        text: string;
        visible: boolean;
        heading?: string;
        utmParams: Record<string, string>;
        selector: string;
    }>;
    trackingEvents: Array<{
        platform: string;
        type: string;
        payload: any;
        ts: number;
    }>;
    screenshot?: Buffer;
}

const DEVICE_CONFIGS: Record<DeviceProfile, { viewport: { width: number; height: number }; userAgent?: string }> = {
    desktop: {
        viewport: { width: 1280, height: 720 },
    },
    tablet: {
        viewport: { width: 768, height: 1024 },
        userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    },
    mobile: {
        viewport: { width: 390, height: 844 },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    },
};

export class BrowserWorker {
    private browser: Browser | null = null;
    private isInitializing = false;

    async init() {
        if (this.browser || this.isInitializing) return;
        this.isInitializing = true;
        try {
            this.browser = await chromium.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
        } finally {
            this.isInitializing = false;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async scanPage(url: string, deviceProfile: DeviceProfile = "desktop"): Promise<BrowserScanResult> {
        if (!this.browser) await this.init();
        if (!this.browser) throw new Error("Browser failed to initialize");

        const config = DEVICE_CONFIGS[deviceProfile];
        const context = await this.browser.newContext({
            viewport: config.viewport,
            userAgent: config.userAgent,
        });

        const page = await context.newPage();
        const result: BrowserScanResult = {
            deviceVariant: deviceProfile,
            url,
            html: "",
            links: [],
            trackingEvents: [],
        };

        try {
            // 1. Inject Tracking Hooks
            await page.addInitScript(() => {
                (window as any).__trackingLog = [];
                const pushEvent = (platform: string, type: string, payload: any) => {
                    (window as any).__trackingLog.push({
                        platform,
                        type,
                        payload,
                        ts: Date.now(),
                    });
                };

                // Hook Mixpanel
                const wrap = (obj: any, method: string, platform: string) => {
                    const original = obj?.[method];
                    if (!original) return;
                    obj[method] = (...args: any[]) => {
                        pushEvent(platform, method, args);
                        try { return original.apply(obj, args); } catch (err) { throw err; }
                    };
                };

                // We need to wait for mixpanel to be available or hook the window property
                let mixpanel = (window as any).mixpanel;
                if (mixpanel) {
                    wrap(mixpanel, 'track', 'mixpanel');
                } else {
                    Object.defineProperty(window, 'mixpanel', {
                        configurable: true,
                        enumerable: true,
                        get() { return this._mixpanel; },
                        set(val) {
                            this._mixpanel = val;
                            if (val) wrap(val, 'track', 'mixpanel');
                        }
                    });
                }

                // Hook GA / Gtag
                wrap(window, 'gtag', 'ga');

                // Hook DataLayer
                const originalPush = (window as any).dataLayer?.push;
                if ((window as any).dataLayer) {
                    (window as any).dataLayer.push = function (...args: any[]) {
                        pushEvent('ga', 'dataLayer.push', args);
                        return originalPush.apply(this, args);
                    };
                } else {
                    Object.defineProperty(window, 'dataLayer', {
                        configurable: true,
                        enumerable: true,
                        get() { return this._dataLayer; },
                        set(val) {
                            this._dataLayer = val;
                            if (val && val.push) {
                                const orig = val.push;
                                val.push = function (...args: any[]) {
                                    pushEvent('ga', 'dataLayer.push', args);
                                    return orig.apply(this, args);
                                };
                            }
                        }
                    });
                }
            });

            // 2. Navigate
            await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

            // Wait a bit for hydration
            await page.waitForTimeout(2000);

            // 3. Extract Content & Links
            result.html = await page.content();

            // Extract Links with Visibility
            result.links = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));

                const isElementVisible = (el: Element) => {
                    if (!el) return false;
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return false;
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
                    return true;
                };

                const findNearestHeading = (el: Element | null): string => {
                    if (!el) return "";
                    try {
                        // Find the nearest preceding heading (h1-h6) in document order
                        // XPath: Select all preceding H tags, or ancestor H tags. Take the last one (closest).
                        const xpath = "(./preceding::*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6] | ./ancestor::*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6])[last()]";
                        const result = document.evaluate(xpath, el, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        const node = result.singleNodeValue;
                        return node ? node.textContent?.trim() || "" : "";
                    } catch (e) {
                        return "";
                    }
                };

                const getSelector = (el: Element): string => {
                    if (el.id) return `#${el.id}`;
                    if (el === document.body) return 'body';

                    let path = [];
                    let current: Element | null = el;

                    while (current && current !== document.body) {
                        let selector = current.tagName.toLowerCase();
                        if (current.className && typeof current.className === 'string') {
                            // Use only first class to avoid overly specific selectors that might break
                            const firstClass = current.className.split(' ')[0];
                            if (firstClass) selector += `.${firstClass}`;
                        }

                        // Add nth-of-type if needed for uniqueness among siblings
                        let sibling = current.previousElementSibling;
                        let index = 1;
                        while (sibling) {
                            if (sibling.tagName === current.tagName) index++;
                            sibling = sibling.previousElementSibling;
                        }
                        if (index > 1) selector += `:nth-of-type(${index})`;

                        path.unshift(selector);
                        current = current.parentElement;
                    }
                    return path.join(' > ');
                };

                return anchors.map((anchor) => {
                    const a = anchor as HTMLAnchorElement;
                    const urlObj = new URL(a.href, window.location.origin);
                    const params: Record<string, string> = {};
                    urlObj.searchParams.forEach((val, key) => {
                        if (key.toLowerCase().startsWith('utm_')) {
                            params[key] = val;
                        }
                    });

                    return {
                        url: a.href,
                        text: a.innerText,
                        visible: isElementVisible(a),
                        heading: findNearestHeading(a),
                        utmParams: params,
                        selector: getSelector(a),
                    };
                });
            });

            // 4. Extract Tracking Logs
            result.trackingEvents = await page.evaluate(() => (window as any).__trackingLog || []);

        } catch (error) {
            console.error(`Browser scan failed for ${url} (${deviceProfile})`, error);
            throw error;
        } finally {
            await context.close();
        }

        return result;
    }
}

export const browserWorker = new BrowserWorker();
