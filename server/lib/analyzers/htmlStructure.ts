import * as cheerio from "cheerio";

/**
 * HTML Structure Analysis Result
 */
export interface HtmlStructureAnalysis {
  // Semantic HTML tags usage
  semanticTags: {
    hasHeader: boolean;
    hasNav: boolean;
    hasMain: boolean;
    hasFooter: boolean;
    hasArticle: boolean;
    hasAside: boolean;
    hasSection: boolean;
    score: number;
  };

  // Heading structure and hierarchy
  headingStructure: {
    hierarchy: Array<{
      level: number;
      text: string;
      issues: string[];
    }>;
    hasH1: boolean;
    multipleH1: boolean;
    skippedLevels: number[];
    score: number;
  };

  // Image optimization
  images: {
    total: number;
    missingAlt: number;
    lazyLoadable: number;
    withDimensions: number;
    examples: Array<{
      src: string;
      alt?: string;
      width?: number;
      height?: number;
      loading?: string;
      issues: string[];
    }>;
    score: number;
  };

  // Form accessibility
  forms: {
    total: number;
    inputs: number;
    missingLabels: number;
    withFieldset: number;
    issues: string[];
    score: number;
  };

  // ARIA attributes and accessibility
  aria: {
    landmarks: number;
    rolesUsed: string[];
    elementsWithAriaLabel: number;
    missingAriaLabels: number;
    score: number;
  };

  // Lists structure
  lists: {
    ul: number;
    ol: number;
    emptyLists: number;
    nestedLists: number;
    score: number;
  };

  // Table structure
  tables: {
    total: number;
    withCaption: number;
    withThead: number;
    withTbody: number;
    score: number;
  };

  // Overall metrics
  overallScore: number;
  errors: string[];
  warnings: string[];
}

/**
 * Analyze HTML structure, semantic tags, accessibility, and best practices
 */
export function analyzeHtmlStructure(html: string): HtmlStructureAnalysis {
  const $ = cheerio.load(html);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Analyze semantic tags
  const semanticTags = analyzeSemanticTags($, errors, warnings);

  // Analyze heading structure
  const headingStructure = analyzeHeadingStructure($, errors, warnings);

  // Analyze images
  const images = analyzeImages($, errors, warnings);

  // Analyze forms
  const forms = analyzeForms($, errors, warnings);

  // Analyze ARIA
  const aria = analyzeAria($, errors, warnings);

  // Analyze lists
  const lists = analyzeLists($, errors, warnings);

  // Analyze tables
  const tables = analyzeTables($, errors, warnings);

  // Calculate overall score
  const overallScore = Math.round(
    (semanticTags.score * 0.2 +
      headingStructure.score * 0.25 +
      images.score * 0.2 +
      forms.score * 0.1 +
      aria.score * 0.15 +
      lists.score * 0.05 +
      tables.score * 0.05)
  );

  return {
    semanticTags,
    headingStructure,
    images,
    forms,
    aria,
    lists,
    tables,
    overallScore: Math.max(0, overallScore),
    errors,
    warnings,
  };
}

/**
 * Analyze semantic HTML5 tags usage
 */
function analyzeSemanticTags(
  $: cheerio.CheerioAPI,
  errors: string[],
  warnings: string[]
) {
  const hasHeader = $("header").length > 0;
  const hasNav = $("nav").length > 0;
  const hasMain = $("main").length > 0;
  const hasFooter = $("footer").length > 0;
  const hasArticle = $("article").length > 0;
  const hasAside = $("aside").length > 0;
  const hasSection = $("section").length > 0;

  let score = 100;

  if (!hasHeader) {
    warnings.push("Missing <header> tag");
    score -= 10;
  }

  if (!hasNav) {
    warnings.push("Missing <nav> tag");
    score -= 10;
  }

  if (!hasMain) {
    errors.push("Missing <main> tag - critical for accessibility");
    score -= 20;
  }

  if (!hasFooter) {
    warnings.push("Missing <footer> tag");
    score -= 10;
  }

  // Multiple main tags is an error
  if ($("main").length > 1) {
    errors.push("Multiple <main> tags found - should have only one");
    score -= 15;
  }

  // Check for excessive div usage (more divs than semantic tags)
  const divCount = $("div").length;
  const semanticCount =
    $("header, nav, main, footer, article, aside, section").length;
  if (divCount > semanticCount * 3 && semanticCount < 5) {
    warnings.push(
      "High div-to-semantic ratio - consider using more semantic HTML5 tags"
    );
    score -= 5;
  }

  return {
    hasHeader,
    hasNav,
    hasMain,
    hasFooter,
    hasArticle,
    hasAside,
    hasSection,
    score: Math.max(0, score),
  };
}

/**
 * Analyze heading hierarchy (h1-h6)
 */
function analyzeHeadingStructure(
  $: cheerio.CheerioAPI,
  errors: string[],
  warnings: string[]
) {
  const hierarchy: Array<{ level: number; text: string; issues: string[] }> =
    [];
  const levels: number[] = [];

  // Collect all headings
  $("h1, h2, h3, h4, h5, h6").each((_, elem) => {
    const tagName = $(elem).prop("tagName")?.toLowerCase() || "";
    const level = parseInt(tagName.charAt(1));
    const text = $(elem).text().trim().substring(0, 100);
    const issues: string[] = [];

    if (!text) {
      issues.push("Empty heading");
    }

    levels.push(level);
    hierarchy.push({ level, text, issues });
  });

  const hasH1 = levels.includes(1);
  const multipleH1 = levels.filter((l) => l === 1).length > 1;
  const skippedLevels: number[] = [];

  // Check for skipped heading levels
  for (let i = 1; i < levels.length; i++) {
    const currentLevel = levels[i];
    const previousLevel = levels[i - 1];

    if (currentLevel === undefined || previousLevel === undefined) continue;

    const diff = currentLevel - previousLevel;
    if (diff > 1) {
      // Mark skipped levels
      for (let j = previousLevel + 1; j < currentLevel; j++) {
        if (!skippedLevels.includes(j)) {
          skippedLevels.push(j);
        }
      }
      const currentHierarchy = hierarchy[i];
      if (currentHierarchy) {
        currentHierarchy.issues.push(
          `Skipped from h${previousLevel} to h${currentLevel}`
        );
      }
    }
  }

  let score = 100;

  if (!hasH1) {
    errors.push("Missing H1 heading");
    score -= 30;
  }

  if (multipleH1) {
    warnings.push("Multiple H1 headings found - should have only one");
    score -= 15;
  }

  if (skippedLevels.length > 0) {
    warnings.push(
      `Skipped heading levels: ${skippedLevels.map((l) => `h${l}`).join(", ")}`
    );
    score -= skippedLevels.length * 10;
  }

  // Check if any headings are empty
  const emptyHeadings = hierarchy.filter((h) => h.issues.includes("Empty heading"));
  if (emptyHeadings.length > 0) {
    errors.push(`${emptyHeadings.length} empty heading(s) found`);
    score -= emptyHeadings.length * 5;
  }

  return {
    hierarchy,
    hasH1,
    multipleH1,
    skippedLevels,
    score: Math.max(0, score),
  };
}

/**
 * Analyze images for alt text, dimensions, and lazy loading
 */
function analyzeImages(
  $: cheerio.CheerioAPI,
  errors: string[],
  warnings: string[]
) {
  const images: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    loading?: string;
    issues: string[];
  }> = [];

  let total = 0;
  let missingAlt = 0;
  let lazyLoadable = 0;
  let withDimensions = 0;

  $("img").each((index, elem) => {
    total++;
    const src = $(elem).attr("src") || "";
    const alt = $(elem).attr("alt");
    const width = $(elem).attr("width");
    const height = $(elem).attr("height");
    const loading = $(elem).attr("loading");
    const issues: string[] = [];

    // Check alt text
    if (alt === undefined || alt === "") {
      missingAlt++;
      issues.push("Missing alt attribute");
    }

    // Check dimensions
    if (width && height) {
      withDimensions++;
    } else {
      issues.push("Missing width/height attributes");
    }

    // Check lazy loading
    if (loading === "lazy") {
      lazyLoadable++;
    } else if (index > 2) {
      // Images below the fold should be lazy loaded
      issues.push("Consider adding loading='lazy'");
    }

    // Only include first 10 images with issues in the report
    if (images.length < 10 && issues.length > 0) {
      images.push({
        src: src.substring(0, 100),
        alt,
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        loading,
        issues,
      });
    }
  });

  let score = 100;

  if (total > 0) {
    const altPercentage = ((total - missingAlt) / total) * 100;
    const dimensionPercentage = (withDimensions / total) * 100;
    const lazyPercentage = total > 3 ? (lazyLoadable / (total - 3)) * 100 : 100;

    if (missingAlt > 0) {
      errors.push(`${missingAlt} image(s) missing alt attribute`);
      score -= Math.min(30, missingAlt * 5);
    }

    if (dimensionPercentage < 50) {
      warnings.push(
        `${total - withDimensions} image(s) missing width/height attributes`
      );
      score -= 15;
    }

    if (lazyPercentage < 50 && total > 5) {
      warnings.push("Consider implementing lazy loading for below-fold images");
      score -= 10;
    }
  }

  return {
    total,
    missingAlt,
    lazyLoadable,
    withDimensions,
    examples: images,
    score: Math.max(0, score),
  };
}

/**
 * Analyze form accessibility
 */
function analyzeForms(
  $: cheerio.CheerioAPI,
  errors: string[],
  warnings: string[]
) {
  const total = $("form").length;
  const inputs = $("input, textarea, select").length;
  let missingLabels = 0;
  const withFieldset = $("fieldset").length;
  const issues: string[] = [];

  // Check each input for associated label
  $("input, textarea, select").each((_, elem) => {
    const id = $(elem).attr("id");
    const ariaLabel = $(elem).attr("aria-label");
    const ariaLabelledby = $(elem).attr("aria-labelledby");
    const type = $(elem).attr("type");

    // Skip hidden inputs
    if (type === "hidden") return;

    // Check if input has a label
    const hasLabel = id && $(`label[for="${id}"]`).length > 0;
    const hasAriaLabel = ariaLabel || ariaLabelledby;

    if (!hasLabel && !hasAriaLabel) {
      missingLabels++;
    }
  });

  let score = 100;

  if (total > 0) {
    if (missingLabels > 0) {
      errors.push(`${missingLabels} form input(s) missing labels`);
      score -= Math.min(40, missingLabels * 10);
    }

    if (withFieldset === 0 && $("input[type='radio'], input[type='checkbox']").length > 1) {
      warnings.push(
        "Consider using <fieldset> to group related form controls"
      );
      score -= 10;
    }

    // Check for missing form labels
    if ($("form").find("button[type='submit'], input[type='submit']").length === 0) {
      const formsWithoutSubmit = $("form").filter((_, form) => {
        return $(form).find("button[type='submit'], input[type='submit']").length === 0;
      }).length;

      if (formsWithoutSubmit > 0) {
        warnings.push(`${formsWithoutSubmit} form(s) without submit button`);
        score -= 10;
      }
    }
  }

  return {
    total,
    inputs,
    missingLabels,
    withFieldset,
    issues,
    score: Math.max(0, score),
  };
}

/**
 * Analyze ARIA attributes and landmarks
 */
function analyzeAria(
  $: cheerio.CheerioAPI,
  errors: string[],
  warnings: string[]
) {
  // Count ARIA landmarks
  const landmarks = $(
    "[role='banner'], [role='navigation'], [role='main'], [role='complementary'], [role='contentinfo'], [role='search'], [role='form']"
  ).length;

  // Collect unique roles
  const rolesUsed = new Set<string>();
  $("[role]").each((_, elem) => {
    const role = $(elem).attr("role");
    if (role) rolesUsed.add(role);
  });

  // Count elements with aria-label or aria-labelledby
  const elementsWithAriaLabel = $(
    "[aria-label], [aria-labelledby]"
  ).length;

  // Check for interactive elements without accessible names
  let missingAriaLabels = 0;
  $("button, a, input, select, textarea").each((_, elem) => {
    const hasText = $(elem).text().trim().length > 0;
    const hasAriaLabel =
      $(elem).attr("aria-label") || $(elem).attr("aria-labelledby");
    const hasAlt = $(elem).attr("alt");
    const hasTitle = $(elem).attr("title");
    const hasLabel = $(elem).attr("id") && $(`label[for="${$(elem).attr("id")}"]`).length > 0;
    const type = $(elem).attr("type");

    // Skip hidden inputs
    if (type === "hidden") return;

    if (!hasText && !hasAriaLabel && !hasAlt && !hasTitle && !hasLabel) {
      missingAriaLabels++;
    }
  });

  let score = 100;

  if (missingAriaLabels > 0) {
    errors.push(
      `${missingAriaLabels} interactive element(s) missing accessible name`
    );
    score -= Math.min(30, missingAriaLabels * 5);
  }

  if (landmarks === 0) {
    warnings.push(
      "No ARIA landmarks found - consider adding role attributes for better accessibility"
    );
    score -= 15;
  }

  return {
    landmarks,
    rolesUsed: Array.from(rolesUsed),
    elementsWithAriaLabel,
    missingAriaLabels,
    score: Math.max(0, score),
  };
}

/**
 * Analyze list structures
 */
function analyzeLists(
  $: cheerio.CheerioAPI,
  errors: string[],
  warnings: string[]
) {
  const ul = $("ul").length;
  const ol = $("ol").length;
  let emptyLists = 0;
  let nestedLists = 0;

  $("ul, ol").each((_, elem) => {
    const items = $(elem).children("li").length;
    if (items === 0) {
      emptyLists++;
    }

    // Check for nested lists
    if ($(elem).find("ul, ol").length > 0) {
      nestedLists++;
    }
  });

  let score = 100;

  if (emptyLists > 0) {
    errors.push(`${emptyLists} empty list(s) found`);
    score -= emptyLists * 10;
  }

  return {
    ul,
    ol,
    emptyLists,
    nestedLists,
    score: Math.max(0, score),
  };
}

/**
 * Analyze table structures
 */
function analyzeTables(
  $: cheerio.CheerioAPI,
  errors: string[],
  warnings: string[]
) {
  const total = $("table").length;
  let withCaption = 0;
  let withThead = 0;
  let withTbody = 0;

  $("table").each((_, elem) => {
    if ($(elem).find("caption").length > 0) withCaption++;
    if ($(elem).find("thead").length > 0) withThead++;
    if ($(elem).find("tbody").length > 0) withTbody++;
  });

  let score = 100;

  if (total > 0) {
    if (withCaption === 0) {
      warnings.push("Tables should have <caption> for accessibility");
      score -= 15;
    }

    if (withThead < total) {
      warnings.push(
        `${total - withThead} table(s) missing <thead> for proper structure`
      );
      score -= 10;
    }
  }

  return {
    total,
    withCaption,
    withThead,
    withTbody,
    score: Math.max(0, score),
  };
}
