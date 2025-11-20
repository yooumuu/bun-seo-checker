const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;
const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
const canonicalRegex = /<link[^>]+rel=["']canonical["'][^>]*>/i;
const metaTagRegex = (name: string) =>
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i");
const ldJsonRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;
const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;

const decodeHtmlEntities = (value: string) =>
    value
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();

const extractAttribute = (snippet: string, attribute: string) => {
    const regex = new RegExp(
        `${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`,
        "i"
    );
    const match = snippet.match(regex);
    return match ? decodeHtmlEntities(match[2] ?? match[3] ?? "") : null;
};

const extractMetaContent = (html: string, name: string) => {
    const match = html.match(metaTagRegex(name));
    if (!match) return null;
    return extractAttribute(match[0], "content");
};

import type { JsonLdAnalysis } from "./jsonld.js";

/**
 * 从文本中提取关键词（简单实现：排除停用词）
 */
const extractKeywords = (text: string): string[] => {
    const stopWords = new Set([
        // 英文停用词
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in',
        'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
        // 中文停用词
        '的', '了', '和', '是', '在', '有', '我', '这', '个', '你', '们'
    ]);

    return text
        .toLowerCase()
        .split(/[\s\-_,;:]+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
};

/**
 * 计算两个词组之间的关键词重叠度
 */
const calculateKeywordOverlap = (keywords1: string[], keywords2: string[]): number => {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1);
    const commonCount = keywords2.filter(word => set1.has(word)).length;

    return commonCount / Math.max(keywords1.length, keywords2.length);
};

/**
 * 检查是否为通用无价值词汇
 */
const isGenericContent = (text: string): boolean => {
    const genericPatterns = [
        // 单一通用词
        /^(home|about|contact|blog|news|welcome|page|main|index|untitled|test)$/i,
        // 纯数字或符号
        /^[\d\s\-_.,!?]+$/,
        // 纯emoji或特殊字符
        /^[\u{1F300}-\u{1F9FF}\s]+$/u,
    ];

    return genericPatterns.some(pattern => pattern.test(text.trim()));
};

/**
 * 评估关键词策略质量 (0-25分)
 */
const evaluateKeywordStrategy = (h1: string, title: string | null, plainText: string): { score: number; issues: string[] } => {
    const issues: string[] = [];
    let score = 25;

    if (!title) {
        // 没有title无法评估关键词相关性，给中等分
        return { score: 15, issues: ['缺少Title标签，无法评估关键词相关性'] };
    }

    const h1Keywords = extractKeywords(plainText);
    const titleKeywords = extractKeywords(title.replace(/<[^>]+>/g, ''));

    // 1. 是否包含Title中的核心关键词 (10分)
    const keywordOverlap = calculateKeywordOverlap(h1Keywords, titleKeywords);

    if (keywordOverlap === 0) {
        score -= 10;
        issues.push('H1未包含Title中的任何关键词');
    } else if (keywordOverlap < 0.3) {
        score -= 6;
        issues.push('H1与Title的关键词相关性较低');
    } else if (keywordOverlap < 0.5) {
        score -= 3;
        issues.push('H1与Title的关键词相关性一般');
    }

    // 2. 关键词位置检查 (5分) - 关键词应该靠前
    if (h1Keywords.length > 0 && titleKeywords.length > 0) {
        const firstKeyword = titleKeywords[0];
        const h1Words = plainText.toLowerCase().split(/\s+/);
        const keywordPosition = h1Words.findIndex(word => word.includes(firstKeyword!));

        if (keywordPosition > 5) {
            score -= 3;
            issues.push('主要关键词位置过于靠后，建议放在H1前部');
        } else if (keywordPosition > 2) {
            score -= 1;
        }
    }

    // 3. 关键词密度检查 (5分) - 避免堆砌
    const wordCount = plainText.split(/\s+/).length;
    if (wordCount > 0) {
        const keywordDensity = h1Keywords.length / wordCount;

        if (keywordDensity > 0.8) {
            score -= 5;
            issues.push('疑似关键词堆砌，影响用户体验和SEO');
        } else if (keywordDensity < 0.3) {
            score -= 2;
            issues.push('关键词密度过低，SEO价值有限');
        }
    }

    // 4. 长尾关键词检查 (5分)
    const hasLongTailKeywords = h1Keywords.length >= 3;
    if (!hasLongTailKeywords) {
        score -= 3;
        issues.push('缺少长尾关键词，建议添加具体描述');
    }

    return { score: Math.max(score, 0), issues };
};

/**
 * 评估内容质量 (0-20分)
 */
const evaluateContentQuality = (plainText: string): { score: number; issues: string[] } => {
    const issues: string[] = [];
    let score = 20;

    // 1. 通用词检查 (8分)
    if (isGenericContent(plainText)) {
        score -= 8;
        issues.push(`H1内容过于通用（"${plainText}"），缺乏描述性和SEO价值`);
    }

    // 2. 语义完整性 (6分) - 是否是完整的短语/句子
    const words = plainText.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
        score -= 6;
        issues.push('H1内容不构成完整短语，建议添加修饰词');
    } else if (words.length < 3) {
        score -= 3;
        issues.push('H1内容较简单，建议增加描述性词汇');
    }

    // 3. 信息价值 (6分) - 是否传达核心价值
    const hasActionWords = /\b(get|find|learn|discover|explore|buy|read|watch|download|free|best|top|guide|how|tips)\b/i.test(plainText);
    const hasValueIndicators = /\b(latest|new|breaking|exclusive|official|complete|ultimate|comprehensive)\b/i.test(plainText);

    if (!hasActionWords && !hasValueIndicators) {
        score -= 4;
        issues.push('H1缺少行动词或价值指标，建议添加以提升吸引力');
    }

    return { score: Math.max(score, 0), issues };
};

/**
 * 评估用户体验 (0-15分)
 */
const evaluateUserExperience = (plainText: string): { score: number; issues: string[] } => {
    const issues: string[] = [];
    let score = 15;

    // 1. 可读性 (6分)
    const hasRepeatedWords = /\b(\w+)\b.*\b\1\b/i.test(plainText);
    if (hasRepeatedWords) {
        score -= 3;
        issues.push('H1包含重复词汇，影响可读性');
    }

    const hasExcessiveCaps = (plainText.match(/[A-Z]/g) || []).length / plainText.length > 0.5;
    if (hasExcessiveCaps && plainText.length > 10) {
        score -= 2;
        issues.push('H1全大写或大写过多，降低可读性');
    }

    // 2. 吸引力 (5分) - 是否能吸引用户点击
    const hasBrandAndValue = plainText.includes('-') || plainText.includes(':') || plainText.includes('|');
    if (!hasBrandAndValue && plainText.split(/\s+/).length < 4) {
        score -= 3;
        issues.push('H1缺少品牌+价值组合，吸引力不足');
    }

    // 3. 清晰度 (4分)
    const specialCharRatio = (plainText.match(/[^a-zA-Z0-9\s\u4e00-\u9fa5\-:,|.]/g) || []).length / plainText.length;
    if (specialCharRatio > 0.3) {
        score -= 4;
        issues.push('H1包含过多特殊字符或符号，影响清晰度');
    }

    return { score: Math.max(score, 0), issues };
};

/**
 * 评估 H1 标签内容质量（专业SEO标准）
 * @param h1 H1 标签文本内容
 * @param title 页面标题（用于关键词分析）
 * @returns { score: 0-100, issues: string[] | undefined, breakdown: object }
 */
const evaluateH1Quality = (h1: string | null, title: string | null): {
    score: number;
    issues?: string[];
    breakdown?: {
        existence: number;
        length: number;
        keywordStrategy: number;
        contentQuality: number;
        userExperience: number;
        technicalImpl: number;
    };
} => {
    const issues: string[] = [];

    // 1. 存在性检查 (15分)
    if (!h1) {
        return {
            score: 0,
            issues: ['H1标签不存在（严重SEO问题）'],
            breakdown: {
                existence: 0,
                length: 0,
                keywordStrategy: 0,
                contentQuality: 0,
                userExperience: 0,
                technicalImpl: 0,
            }
        };
    }

    let existenceScore = 15;
    const trimmedH1 = h1.trim();

    // 2. 技术实现检查 (10分)
    let technicalScore = 10;
    const hasSvg = /<svg[\s\S]*?<\/svg>/i.test(h1);
    const hasImage = /<img[\s\S]*?>/i.test(h1);

    if (hasSvg || hasImage) {
        technicalScore -= 8;
        issues.push('使用SVG/图片而非纯文本（搜索引擎识别度低，扣8分）');
    }

    const hasExcessiveNesting = (h1.match(/<[^>]+>/g) || []).length > 3;
    if (hasExcessiveNesting) {
        technicalScore -= 2;
        issues.push('HTML嵌套过深，建议简化结构');
    }

    // 提取纯文本
    const plainText = trimmedH1.replace(/<[^>]+>/g, '').trim();
    const plainLength = plainText.length;

    if (plainLength === 0) {
        return {
            score: 0,
            issues: ['H1标签为空（严重SEO问题）'],
            breakdown: {
                existence: 0,
                length: 0,
                keywordStrategy: 0,
                contentQuality: 0,
                userExperience: 0,
                technicalImpl: 0,
            }
        };
    }

    // 3. 长度优化 (15分)
    let lengthScore = 15;

    if (plainLength < 10) {
        lengthScore -= 12;
        issues.push(`H1过短（${plainLength}字符），SEO价值极低，建议20-70字符`);
    } else if (plainLength < 20) {
        lengthScore -= 6;
        issues.push(`H1偏短（${plainLength}字符），建议20-70字符`);
    } else if (plainLength > 100) {
        lengthScore -= 8;
        issues.push(`H1过长（${plainLength}字符），移动端显示可能截断`);
    } else if (plainLength > 70) {
        lengthScore -= 3;
        issues.push(`H1偏长（${plainLength}字符），建议控制在70字符内`);
    }

    // 4. 关键词策略 (25分) - 最重要
    const keywordEval = evaluateKeywordStrategy(h1, title, plainText);
    issues.push(...keywordEval.issues);

    // 5. 内容质量 (20分)
    const contentEval = evaluateContentQuality(plainText);
    issues.push(...contentEval.issues);

    // 6. 用户体验 (15分)
    const uxEval = evaluateUserExperience(plainText);
    issues.push(...uxEval.issues);

    const totalScore = existenceScore + lengthScore + keywordEval.score + contentEval.score + uxEval.score + technicalScore;

    return {
        score: Math.max(Math.min(totalScore, 100), 0),
        issues: issues.length > 0 ? issues : undefined,
        breakdown: {
            existence: existenceScore,
            length: lengthScore,
            keywordStrategy: keywordEval.score,
            contentQuality: contentEval.score,
            userExperience: uxEval.score,
            technicalImpl: technicalScore,
        }
    };
};

export type SeoAnalysis = {
    title: string | null;
    metaDescription: string | null;
    canonical: string | null;
    h1: string | null;
    h1Score?: number; // H1 质量评分 (0-100)
    h1Issues?: string[]; // H1 存在的问题
    robotsTxtBlocked: boolean;
    schemaOrg: unknown;
    jsonLdAnalysis?: JsonLdAnalysis; // JSON-LD 详细分析结果
    score: number;
};

type DeviceVariant = "desktop" | "tablet" | "mobile";

export type LinkAnalysis = {
    internalLinks: number;
    externalLinks: number;
    utmSummary: {
        trackedLinks: number;
        missingUtm: number;
        examples: Array<{
            url: string;
            params: string[];
            text?: string | null;
            heading?: {
                tag: string | null;
                text: string | null;
            } | null;
            deviceVariant?: DeviceVariant | null;
            selector?: string | null;
            triggeredEvents?: TrackingEventAnalysis[];
        }>;
    };
    brokenLinks: number;
    redirects: number;
    discoveredInternalUrls: string[];
};

export type LinkWithUrl = {
    url: string;
    isInternal: boolean;
};

export type TrackingEventAnalysis = {
    element: string;
    trigger: string;
    platform: string;
    status: string;
    eventName?: string | null;
    deviceVariant?: DeviceVariant | null;
    payload?: any;
};

type SeoIssueMap = Record<string, boolean> & {
    missingTitle: boolean;
    missingDescription: boolean;
    missingH1: boolean;
    missingCanonical: boolean;
    robotsBlocked: boolean;
    jsonLdMissing: boolean;
    jsonLdInvalid: boolean;
    jsonLdIncomplete: boolean;
};

type LinkIssueMap = Record<string, number> & {
    internalLinks: number;
    externalLinks: number;
    utmMissing: number;
    utmTracked: number;
};

type TrackingIssueMap = Record<string, boolean> & {
    mixpanelMissing: boolean;
    gaMissing: boolean;
};

type IssueSummaryMeta = {
    seoScore: number;
    jsonLdScore?: number;
    jsonLdTypes?: string[];
    htmlStructureScore?: number;
};

type HtmlStructureIssueMap = Record<string, number> & {
    semanticIssues: number;
    headingIssues: number;
    imageIssues: number;
    accessibilityIssues: number;
};

export type IssueSummary = {
    seo: SeoIssueMap;
    links: LinkIssueMap;
    tracking: TrackingIssueMap;
    htmlStructure?: HtmlStructureIssueMap;
    totals: {
        seoIssues: number;
        linkIssues: number;
        trackingIssues: number;
        htmlStructureIssues?: number;
    };
    meta: IssueSummaryMeta;
};

export const analyzeSeo = (html: string): SeoAnalysis => {
    const titleMatch = html.match(titleRegex);
    const h1Match = html.match(h1Regex);
    const canonicalMatch = html.match(canonicalRegex);
    const ldJsonMatch = html.match(ldJsonRegex);

    const robotsMeta = extractMetaContent(html, "robots");

    const title = titleMatch?.[1]
        ? decodeHtmlEntities(titleMatch[1])
        : null;
    const metaDescription = extractMetaContent(html, "description");
    const h1 = h1Match?.[1]
        ? decodeHtmlEntities(h1Match[1])
        : null;
    const canonical = canonicalMatch
        ? extractAttribute(canonicalMatch[0], "href")
        : null;

    let schemaOrg: unknown = null;
    if (ldJsonMatch) {
        try {
            schemaOrg = ldJsonMatch[1] ? JSON.parse(ldJsonMatch[1]) : null;
        } catch {
            schemaOrg = ldJsonMatch[1]?.trim() ?? null;
        }
    }

    const robotsTxtBlocked =
        robotsMeta?.toLowerCase().includes("noindex") ?? false;

    // 评估 H1 质量
    const h1Evaluation = evaluateH1Quality(h1, title);

    let score = 100;
    if (!title) score -= 30;
    if (!metaDescription) score -= 20;

    // H1 评分：根据质量评分动态扣分
    // H1Score 100 = 不扣分
    // H1Score 80 = 扣 4 分
    // H1Score 60 = 扣 8 分
    // H1Score 40 = 扣 12 分
    // H1Score 0 = 扣 20 分
    const h1Penalty = Math.round((100 - h1Evaluation.score) * 0.2);
    score -= h1Penalty;

    if (!canonical) score -= 10;
    if (robotsTxtBlocked) score -= 20;
    if (!schemaOrg) score -= 5;

    return {
        title,
        metaDescription,
        canonical,
        h1,
        h1Score: h1Evaluation.score,
        h1Issues: h1Evaluation.issues && h1Evaluation.issues.length > 0 ? h1Evaluation.issues : undefined,
        robotsTxtBlocked,
        schemaOrg,
        score: Math.max(score, 0),
    };
};

// Helper function to check link status
const checkLinkStatus = async (url: string): Promise<{ isRedirect: boolean; isBroken: boolean; status: number }> => {
    try {
        // Try HEAD first, fall back to GET if HEAD is not supported
        let response = await fetch(url, {
            method: 'HEAD',
            redirect: 'manual', // Don't follow redirects
            signal: AbortSignal.timeout(5000), // 5 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SEO-Checker/1.0)',
            }
        });

        // If HEAD returns 405 (Method Not Allowed) or 400, try GET
        if (response.status === 405 || response.status === 400) {
            response = await fetch(url, {
                method: 'GET',
                redirect: 'manual',
                signal: AbortSignal.timeout(5000),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SEO-Checker/1.0)',
                }
            });
        }

        const isRedirect = response.status >= 300 && response.status < 400;
        const isBroken = response.status >= 400;

        return { isRedirect, isBroken, status: response.status };
    } catch (error) {
        // If fetch fails (network error, timeout), consider it broken
        return { isRedirect: false, isBroken: true, status: 0 };
    }
};

// Async version that checks link statuses
export const analyzeLinksAsync = async (
    html: string,
    baseUrl: string,
    options?: {
        checkLinkHealth?: boolean;
        maxLinksToCheck?: number;
        sampleInternal?: boolean;
    }
): Promise<LinkAnalysis> => {
    // First run the synchronous analysis
    const basicAnalysis = analyzeLinks(html, baseUrl);

    // If link health check is not enabled, return basic analysis
    if (!options?.checkLinkHealth) {
        return basicAnalysis;
    }

    // Extract ALL internal links from HTML for checking
    const internalLinksToCheck = new Set<string>();
    const base = new URL(baseUrl);

    // Parse all anchor tags from HTML
    let match: RegExpExecArray | null;
    const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;

    while ((match = anchorRegex.exec(html))) {
        const href = decodeHtmlEntities(match[1] ?? match[2] ?? "");
        if (!href) continue;

        try {
            const normalized = new URL(href, base).toString();
            const linkUrl = new URL(normalized);

            // Only check internal links
            if (linkUrl.hostname === base.hostname) {
                internalLinksToCheck.add(normalized);
                if (internalLinksToCheck.size >= (options.maxLinksToCheck ?? 50)) {
                    break;
                }
            }
        } catch {
            continue;
        }
    }

    // If sampling is enabled, only check a subset
    const linksArray = Array.from(internalLinksToCheck);
    const linksToCheck = options.sampleInternal && linksArray.length > 10
        ? linksArray.slice(0, 10)
        : linksArray;

    // Check link statuses in parallel (with concurrency limit)
    let redirectCount = 0;
    let brokenCount = 0;

    const checkPromises = linksToCheck.map(url => checkLinkStatus(url));
    const results = await Promise.allSettled(checkPromises);

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const url = linksToCheck[i];

        if (!result || !url) continue;

        if (result.status === 'fulfilled') {
            const { isRedirect, isBroken } = result.value;

            if (isRedirect) {
                redirectCount++;
            }
            if (isBroken) {
                brokenCount++;
            }
        }
    }

    return {
        ...basicAnalysis,
        brokenLinks: brokenCount,
        redirects: redirectCount,
    };
};

export const analyzeLinks = (
    html: string,
    baseUrl: string
): LinkAnalysis => {
    const detectDeviceVariant = (snippet: string): DeviceVariant | null => {
        const attrs = [
            extractAttribute(snippet, "class"),
            extractAttribute(snippet, "data-device"),
            extractAttribute(snippet, "data-viewport"),
            extractAttribute(snippet, "data-framer-name"),
            extractAttribute(snippet, "data-framer-viewport"),
            extractAttribute(snippet, "data-breakpoint"),
        ]
            .filter(Boolean)
            .map((value) => value!.toLowerCase())
            .join(" ");

        if (!attrs) return null;

        const contains = (keywords: string[]) =>
            keywords.some((keyword) =>
                attrs.split(/\s+/).some((token) => token.includes(keyword))
            );

        if (contains(["desktop", "laptop", "pc"])) return "desktop";
        if (contains(["tablet", "ipad"])) return "tablet";
        if (contains(["mobile", "phone", "iphone", "android"])) return "mobile";
        return null;
    };

    const base = new URL(baseUrl);
    const examples: Array<{
        url: string;
        params: string[];
        text?: string | null;
        heading?: { tag: string | null; text: string | null } | null;
        deviceVariant?: DeviceVariant | null;
    }> = [];
    type Heading = { tag: string; text: string; index: number };
    const headingRegex =
        /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
    const headings: Heading[] = [];
    let headingMatch: RegExpExecArray | null;
    while ((headingMatch = headingRegex.exec(html))) {
        const tag = headingMatch[1] ?? "h1";
        const rawText = headingMatch[2] ?? "";
        headings.push({
            tag,
            text: decodeHtmlEntities(rawText.replace(/<[^>]+>/g, "").trim()),
            index: headingMatch.index ?? 0,
        });
    }
    let headingPointer = 0;
    let currentHeading: Heading | null = headings[0] ?? null;
    const discoveredInternal = new Set<string>();
    let internal = 0;
    let external = 0;
    let tracked = 0;
    let missing = 0;

    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(html))) {
        const href = decodeHtmlEntities(match[1] ?? match[2] ?? "");
        if (!href) continue;
        try {
            const normalized = new URL(href, base).toString();
            const linkUrl = new URL(normalized);
            const isInternal = linkUrl.hostname === base.hostname;
            const utmParams = Array.from(linkUrl.searchParams.keys()).filter(
                (key) => key.toLowerCase().startsWith("utm_")
            );
            const anchorIndex = match.index ?? 0;

            // Extract link text
            const rawText = match[3] ?? "";
            const linkText = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, "").trim());

            while (
                headingPointer < headings.length &&
                headings[headingPointer]!.index <= anchorIndex
            ) {
                currentHeading = headings[headingPointer]!;
                headingPointer += 1;
            }

            if (isInternal) internal += 1;
            else external += 1;

            if (utmParams.length > 0) {
                tracked += 1;
                examples.push({
                    url: normalized,
                    params: utmParams,
                    text: linkText || null,
                    heading: currentHeading
                        ? {
                            tag: currentHeading.tag,
                            text: currentHeading.text || null,
                        }
                        : null,
                    deviceVariant: detectDeviceVariant(match[0]),
                });
            } else if (isInternal) {
                missing += 1;
                examples.push({
                    url: normalized,
                    params: [],
                    text: linkText || null,
                    heading: currentHeading
                        ? {
                            tag: currentHeading.tag,
                            text: currentHeading.text || null,
                        }
                        : null,
                    deviceVariant: detectDeviceVariant(match[0]),
                });
            }

            if (isInternal && discoveredInternal.size < 200) {
                linkUrl.hash = "";
                const normalizedPath = linkUrl.toString().replace(/\/$/, "");
                discoveredInternal.add(normalizedPath);
            }
        } catch {
            continue;
        }
    }

    return {
        internalLinks: internal,
        externalLinks: external,
        utmSummary: {
            trackedLinks: tracked,
            missingUtm: missing,
            examples,
        },
        brokenLinks: 0,
        redirects: 0,
        discoveredInternalUrls: Array.from(discoveredInternal),
    };
};

export const analyzeTracking = (html: string): TrackingEventAnalysis[] => {
    const extractMatches = (
        source: string,
        regex: RegExp,
        map: (match: RegExpExecArray) => TrackingEventAnalysis
    ) => {
        const results: TrackingEventAnalysis[] = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(source))) {
            results.push(map(match));
        }
        return results;
    };

    const events: TrackingEventAnalysis[] = [];
    const lower = html.toLowerCase();

    // Mixpanel: track() - 事件追踪
    const mixpanelEventRegex =
        /(?:window\?\.)?mixpanel\?\.track\s*\(\s*(['"`])([^'"`]+)\1/gi;
    events.push(
        ...extractMatches(html, mixpanelEventRegex, (match) => ({
            element: "script",
            trigger: "track",
            platform: "mixpanel",
            status: "detected",
            eventName: match[2]?.trim() ?? null,
        }))
    );

    // Mixpanel: init() - SDK 初始化
    const mixpanelInitRegex =
        /(?:window\?\.)?mixpanel\?\.init\s*\(\s*(['"`])([^'"`]+)\1/gi;
    events.push(
        ...extractMatches(html, mixpanelInitRegex, (match) => ({
            element: "script",
            trigger: "init",
            platform: "mixpanel",
            status: "detected",
            eventName: `Token: ${match[2]?.trim() ?? 'unknown'}`,
        }))
    );

    // Mixpanel: identify() - 用户识别
    const mixpanelIdentifyRegex =
        /(?:window\?\.)?mixpanel\?\.identify\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelIdentifyRegex, () => ({
            element: "script",
            trigger: "identify",
            platform: "mixpanel",
            status: "detected",
            eventName: "User Identify",
        }))
    );

    // Mixpanel: alias() - 用户别名
    const mixpanelAliasRegex =
        /(?:window\?\.)?mixpanel\?\.alias\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelAliasRegex, () => ({
            element: "script",
            trigger: "alias",
            platform: "mixpanel",
            status: "detected",
            eventName: "User Alias",
        }))
    );

    // Mixpanel: register() - 全局属性注册
    const mixpanelRegisterRegex =
        /(?:window\?\.)?mixpanel\?\.register\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelRegisterRegex, () => ({
            element: "script",
            trigger: "register",
            platform: "mixpanel",
            status: "detected",
            eventName: "Register Properties",
        }))
    );

    // Mixpanel: people.set() - 用户属性设置
    const mixpanelPeopleSetRegex =
        /(?:window\?\.)?mixpanel\?\.people\?\.set\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelPeopleSetRegex, () => ({
            element: "script",
            trigger: "people.set",
            platform: "mixpanel",
            status: "detected",
            eventName: "Set User Properties",
        }))
    );

    // Mixpanel: people.set_once() - 用户属性设置（仅一次）
    const mixpanelPeopleSetOnceRegex =
        /(?:window\?\.)?mixpanel\?\.people\?\.set_once\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelPeopleSetOnceRegex, () => ({
            element: "script",
            trigger: "people.set_once",
            platform: "mixpanel",
            status: "detected",
            eventName: "Set User Properties Once",
        }))
    );

    // Mixpanel: people.increment() - 增量更新
    const mixpanelPeopleIncrementRegex =
        /(?:window\?\.)?mixpanel\?\.people\?\.increment\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelPeopleIncrementRegex, () => ({
            element: "script",
            trigger: "people.increment",
            platform: "mixpanel",
            status: "detected",
            eventName: "Increment User Property",
        }))
    );

    // Mixpanel: time_event() - 事件计时
    const mixpanelTimeEventRegex =
        /(?:window\?\.)?mixpanel\?\.time_event\s*\(\s*(['"`])([^'"`]+)\1/gi;
    events.push(
        ...extractMatches(html, mixpanelTimeEventRegex, (match) => ({
            element: "script",
            trigger: "time_event",
            platform: "mixpanel",
            status: "detected",
            eventName: `Time: ${match[2]?.trim() ?? 'unknown'}`,
        }))
    );

    // Mixpanel: track_links() - 链接追踪配置
    const mixpanelTrackLinksRegex =
        /(?:window\?\.)?mixpanel\?\.track_links\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelTrackLinksRegex, () => ({
            element: "script",
            trigger: "track_links",
            platform: "mixpanel",
            status: "detected",
            eventName: "Link Tracking Configured",
        }))
    );

    // Mixpanel: track_forms() - 表单追踪配置
    const mixpanelTrackFormsRegex =
        /(?:window\?\.)?mixpanel\?\.track_forms\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelTrackFormsRegex, () => ({
            element: "script",
            trigger: "track_forms",
            platform: "mixpanel",
            status: "detected",
            eventName: "Form Tracking Configured",
        }))
    );

    // Mixpanel: reset() - 重置用户
    const mixpanelResetRegex =
        /(?:window\?\.)?mixpanel\?\.reset\s*\(/gi;
    events.push(
        ...extractMatches(html, mixpanelResetRegex, () => ({
            element: "script",
            trigger: "reset",
            platform: "mixpanel",
            status: "detected",
            eventName: "User Reset",
        }))
    );

    // 检测 Mixpanel SDK 加载（脚本标签）
    const mixpanelScriptRegex = /<script[^>]*src\s*=\s*["']([^"']*mixpanel[^"']*)["']/gi;
    events.push(
        ...extractMatches(html, mixpanelScriptRegex, (match) => ({
            element: "script",
            trigger: "sdk_load",
            platform: "mixpanel",
            status: "detected",
            eventName: `SDK: ${match[1]?.trim() ?? 'unknown'}`,
        }))
    );

    // 检测 Mixpanel Autotrack - 自动追踪配置
    // 方式1: mixpanel.init(..., {track_pageview: true, track_links_timeout: ...})
    const autotrackInitRegex = /mixpanel\?\.init\s*\([^)]*\{[^}]*(?:track_pageview|track_links_timeout|autotrack|auto_track)[^}]*\}/gi;
    if (autotrackInitRegex.test(html)) {
        events.push({
            element: "script",
            trigger: "autotrack",
            platform: "mixpanel",
            status: "detected",
            eventName: "Autotrack Enabled (via init config)",
        });
    }

    // 方式2: mixpanel.set_config({autotrack: true})
    const autotrackConfigRegex = /mixpanel\?\.set_config\s*\(\s*\{[^}]*autotrack[^}]*\}/gi;
    if (autotrackConfigRegex.test(html)) {
        events.push({
            element: "script",
            trigger: "autotrack",
            platform: "mixpanel",
            status: "detected",
            eventName: "Autotrack Enabled (via set_config)",
        });
    }

    // 如果没有检测到任何 Mixpanel API，但页面包含 mixpanel 关键字
    if (events.filter(e => e.platform === "mixpanel").length === 0 && /mixpanel/.test(lower)) {
        events.push({
            element: "script",
            trigger: "load",
            platform: "mixpanel",
            status: "detected",
            eventName: null,
        });
    }

    const gtagEventRegex = new RegExp(
        String.raw`gtag\s*\(\s*(["'])event\1\s*,\s*(["'])([^"']+)\2`,
        "gi"
    );
    events.push(
        ...extractMatches(html, gtagEventRegex, (match) => ({
            element: "script",
            trigger: "event",
            platform: "ga",
            status: "detected",
            eventName: match[3]?.trim() ?? null,
        }))
    );

    const dataLayerRegex = new RegExp(
        String.raw`dataLayer(?:\?\.)?\.push\s*\(\s*\{[^}]*event\s*:\s*(["'])([^"']+)\1`,
        "gi"
    );
    events.push(
        ...extractMatches(html, dataLayerRegex, (match) => ({
            element: "dataLayer",
            trigger: "push",
            platform: "ga",
            status: "detected",
            eventName: match[2]?.trim() ?? null,
        }))
    );

    if (
        !events.some((event) => event.platform === "ga") &&
        (/\bgtag\(/i.test(html) ||
            new RegExp(String.raw`\bga\((["'])send`, "i").test(html))
    ) {
        events.push({
            element: "script",
            trigger: "load",
            platform: "ga",
            status: "detected",
            eventName: null,
        });
    }

    return events;
};

export const buildIssueSummary = (
    seo: SeoAnalysis,
    links: LinkAnalysis,
    tracking: TrackingEventAnalysis[],
    htmlStructure?: any
): IssueSummary => {
    const mixpanelPresent = tracking.some(
        (event) => event.platform === "mixpanel"
    );
    const gaPresent = tracking.some((event) => event.platform === "ga");

    const seoMap: SeoIssueMap = {
        missingTitle: !seo.title,
        missingDescription: !seo.metaDescription,
        missingH1: !seo.h1,
        missingCanonical: !seo.canonical,
        robotsBlocked: seo.robotsTxtBlocked,
        jsonLdMissing: !(seo.jsonLdAnalysis?.exists ?? false),
        jsonLdInvalid: (seo.jsonLdAnalysis?.exists && !seo.jsonLdAnalysis?.isValid) || false,
        jsonLdIncomplete: (seo.jsonLdAnalysis?.isValid && (seo.jsonLdAnalysis?.score ?? 0) < 70) || false,
    };

    const linkMap: LinkIssueMap = {
        internalLinks: links.internalLinks,
        externalLinks: links.externalLinks,
        utmMissing: links.utmSummary.missingUtm,
        utmTracked: links.utmSummary.trackedLinks,
    };

    const trackingMap: TrackingIssueMap = {
        mixpanelMissing: !mixpanelPresent,
        gaMissing: !gaPresent,
    };

    let htmlStructureMap: HtmlStructureIssueMap | undefined;
    let htmlStructureIssuesCount = 0;

    if (htmlStructure) {
        // Count semantic issues
        const semanticIssues =
            (!htmlStructure.semanticTags?.hasMain ? 1 : 0) +
            (!htmlStructure.semanticTags?.hasHeader ? 1 : 0) +
            (!htmlStructure.semanticTags?.hasNav ? 1 : 0) +
            (!htmlStructure.semanticTags?.hasFooter ? 1 : 0);

        // Count heading issues
        const headingIssues =
            (!htmlStructure.headingStructure?.hasH1 ? 1 : 0) +
            (htmlStructure.headingStructure?.multipleH1 ? 1 : 0) +
            (htmlStructure.headingStructure?.skippedLevels?.length || 0);

        // Count image issues
        const imageIssues =
            (htmlStructure.images?.missingAlt || 0);

        // Count accessibility issues
        const accessibilityIssues =
            (htmlStructure.forms?.missingLabels || 0) +
            (htmlStructure.aria?.missingAriaLabels || 0) +
            (htmlStructure.lists?.emptyLists || 0);

        htmlStructureMap = {
            semanticIssues,
            headingIssues,
            imageIssues,
            accessibilityIssues,
        };

        htmlStructureIssuesCount = semanticIssues + headingIssues + imageIssues + accessibilityIssues;
    }

    const totals = {
        seoIssues: Object.values(seoMap).filter(Boolean).length,
        linkIssues: links.utmSummary.missingUtm,
        trackingIssues:
            Number(trackingMap.mixpanelMissing) + Number(trackingMap.gaMissing),
        htmlStructureIssues: htmlStructureIssuesCount > 0 ? htmlStructureIssuesCount : undefined,
    };

    return {
        seo: seoMap,
        links: linkMap,
        tracking: trackingMap,
        htmlStructure: htmlStructureMap,
        totals,
        meta: {
            seoScore: seo.score,
            jsonLdScore: seo.jsonLdAnalysis?.score,
            jsonLdTypes: seo.jsonLdAnalysis?.types,
            htmlStructureScore: htmlStructure?.overallScore,
        },
    };
};

export type AggregatedIssueSummary = {
    seo: Record<string, number>;
    links: LinkIssueMap;
    tracking: Record<string, number>;
    totals: {
        seoIssues: number;
        linkIssues: number;
        trackingIssues: number;
    };
    pagesAnalysed: number;
    scorecard: {
        seoAverageScore: number;
        utmCoveragePercent: number;
        trackingCoverage: {
            mixpanel: number;
            ga: number;
            average: number;
        };
        overallHealthPercent: number;
    };
};

export const aggregateSummaries = (
    summaries: IssueSummary[]
): AggregatedIssueSummary => {
    const aggregatedSeo: Record<string, number> = {};
    const aggregatedLinks: LinkIssueMap = {
        internalLinks: 0,
        externalLinks: 0,
        utmMissing: 0,
        utmTracked: 0,
    };
    const aggregatedTracking: Record<string, number> = {};
    const totals = { seoIssues: 0, linkIssues: 0, trackingIssues: 0 };
    let seoScoreTotal = 0;

    if (summaries.length === 0) {
        return {
            seo: aggregatedSeo,
            links: aggregatedLinks,
            tracking: aggregatedTracking,
            totals,
            pagesAnalysed: 0,
            scorecard: {
                seoAverageScore: 0,
                utmCoveragePercent: 0,
                trackingCoverage: {
                    mixpanel: 0,
                    ga: 0,
                    average: 0,
                },
                overallHealthPercent: 0,
            },
        };
    }

    for (const summary of summaries) {
        totals.seoIssues += summary.totals.seoIssues;
        totals.linkIssues += summary.totals.linkIssues;
        totals.trackingIssues += summary.totals.trackingIssues;
        seoScoreTotal += summary.meta.seoScore ?? 0;

        for (const [key, value] of Object.entries(summary.seo)) {
            aggregatedSeo[key] = (aggregatedSeo[key] ?? 0) + (value ? 1 : 0);
        }

        aggregatedLinks.internalLinks += summary.links.internalLinks ?? 0;
        aggregatedLinks.externalLinks += summary.links.externalLinks ?? 0;
        aggregatedLinks.utmMissing += summary.links.utmMissing ?? 0;
        aggregatedLinks.utmTracked += summary.links.utmTracked ?? 0;

        for (const [key, value] of Object.entries(summary.tracking)) {
            aggregatedTracking[key] =
                (aggregatedTracking[key] ?? 0) + (value ? 1 : 0);
        }
    }

    const pagesAnalysed = summaries.length;
    const seoAverageScore = pagesAnalysed
        ? Math.round(seoScoreTotal / pagesAnalysed)
        : 0;
    const totalTrackedLinks = aggregatedLinks.utmTracked ?? 0;
    const totalMissingLinks = aggregatedLinks.utmMissing ?? 0;
    const linkDenominator = totalTrackedLinks + totalMissingLinks;
    const utmCoveragePercent =
        linkDenominator > 0
            ? Math.round((totalTrackedLinks / linkDenominator) * 100)
            : 0;

    const mixpanelMissing = aggregatedTracking.mixpanelMissing ?? 0;
    const gaMissing = aggregatedTracking.gaMissing ?? 0;
    const mixpanelCoverage = pagesAnalysed
        ? Math.round(((pagesAnalysed - mixpanelMissing) / pagesAnalysed) * 100)
        : 0;
    const gaCoverage = pagesAnalysed
        ? Math.round(((pagesAnalysed - gaMissing) / pagesAnalysed) * 100)
        : 0;
    const trackingCoverageAverage = Math.round(
        (mixpanelCoverage + gaCoverage) / 2
    );

    const overallHealthPercent = Math.round(
        (seoAverageScore + utmCoveragePercent + trackingCoverageAverage) / 3
    );

    return {
        seo: aggregatedSeo,
        links: aggregatedLinks,
        tracking: aggregatedTracking,
        totals,
        pagesAnalysed,
        scorecard: {
            seoAverageScore,
            utmCoveragePercent,
            trackingCoverage: {
                mixpanel: mixpanelCoverage,
                ga: gaCoverage,
                average: trackingCoverageAverage,
            },
            overallHealthPercent,
        },
    };
};
