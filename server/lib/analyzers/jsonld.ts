/**
 * JSON-LD 结构化数据分析器
 * 验证 Schema.org JSON-LD 的格式和内容质量
 */

export interface JsonLdSchema {
  type: string; // @type 字段
  data: Record<string, any>; // 完整的 JSON-LD 数据
  requiredFields: Record<string, boolean>; // 必需字段检查结果
  recommendedFields: Record<string, boolean>; // 推荐字段检查结果
  errors: string[];
  warnings: string[];
  score: number; // 单个 schema 的质量分数 (0-100)
}

export interface JsonLdAnalysis {
  exists: boolean; // 是否存在 JSON-LD 脚本
  isValid: boolean; // JSON 格式是否有效
  hasContext: boolean; // 是否有 @context
  hasType: boolean; // 是否有 @type
  types: string[]; // 所有检测到的 @type 类型
  schemas: JsonLdSchema[]; // 每个 JSON-LD 块的详细分析
  errors: string[]; // 全局错误
  warnings: string[]; // 全局警告
  score: number; // 整体 JSON-LD 质量分数 (0-100)
}

// Schema.org 类型的必需字段和推荐字段定义
const SCHEMA_RULES: Record<
  string,
  { required: string[]; recommended: string[] }
> = {
  Organization: {
    required: ["name", "url"],
    recommended: ["logo", "sameAs", "contactPoint", "address"],
  },
  WebSite: {
    required: ["name", "url"],
    recommended: ["potentialAction", "description"],
  },
  WebPage: {
    required: ["name", "url"],
    recommended: ["breadcrumb", "datePublished", "description"],
  },
  Article: {
    required: ["headline", "author", "datePublished"],
    recommended: ["image", "publisher", "dateModified", "description"],
  },
  BlogPosting: {
    required: ["headline", "author", "datePublished"],
    recommended: ["image", "publisher", "dateModified", "description"],
  },
  NewsArticle: {
    required: ["headline", "author", "datePublished"],
    recommended: ["image", "publisher", "dateModified", "description"],
  },
  BreadcrumbList: {
    required: ["itemListElement"],
    recommended: [],
  },
  Product: {
    required: ["name", "image"],
    recommended: ["brand", "offers", "review", "aggregateRating", "description"],
  },
  LocalBusiness: {
    required: ["name", "address"],
    recommended: ["telephone", "openingHours", "priceRange", "image"],
  },
  Person: {
    required: ["name"],
    recommended: ["image", "jobTitle", "url", "sameAs"],
  },
  Event: {
    required: ["name", "startDate", "location"],
    recommended: ["description", "endDate", "organizer", "image"],
  },
  FAQPage: {
    required: ["mainEntity"],
    recommended: [],
  },
  HowTo: {
    required: ["name", "step"],
    recommended: ["description", "image", "totalTime"],
  },
  VideoObject: {
    required: ["name", "description", "thumbnailUrl", "uploadDate"],
    recommended: ["contentUrl", "embedUrl", "duration"],
  },
};

/**
 * 从 HTML 中提取所有 JSON-LD 脚本
 */
function extractJsonLdScripts(html: string): string[] {
  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: string[] = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      scripts.push(match[1].trim());
    }
  }

  return scripts;
}

/**
 * 检查字段是否存在（支持嵌套路径，如 "author.name"）
 */
function hasField(data: any, fieldPath: string): boolean {
  const parts = fieldPath.split(".");
  let current = data;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }

  return current !== undefined && current !== null && current !== "";
}

/**
 * 分析单个 JSON-LD 数据块
 */
function analyzeSchema(data: any): JsonLdSchema {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // 提取 @type
  let types: string[] = [];
  if (data["@type"]) {
    types = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
  } else {
    errors.push("缺少 @type 字段");
    score -= 30;
  }

  const primaryType = types[0] || "Unknown";

  // 检查 @context
  if (!data["@context"]) {
    errors.push("缺少 @context 字段");
    score -= 20;
  } else if (
    typeof data["@context"] === "string" &&
    !data["@context"].includes("schema.org")
  ) {
    warnings.push("@context 不指向 schema.org");
    score -= 10;
  }

  // 根据类型检查必需字段和推荐字段
  const requiredFields: Record<string, boolean> = {};
  const recommendedFields: Record<string, boolean> = {};

  const rules = SCHEMA_RULES[primaryType];
  if (rules) {
    // 检查必需字段
    for (const field of rules.required) {
      const exists = hasField(data, field);
      requiredFields[field] = exists;
      if (!exists) {
        errors.push(`${primaryType} 缺少必需字段: ${field}`);
        score -= 15;
      }
    }

    // 检查推荐字段
    for (const field of rules.recommended) {
      const exists = hasField(data, field);
      recommendedFields[field] = exists;
      if (!exists) {
        warnings.push(`${primaryType} 缺少推荐字段: ${field}`);
        score -= 5;
      }
    }
  } else if (primaryType !== "Unknown") {
    // 未知类型，但有 @type
    warnings.push(`未识别的 Schema.org 类型: ${primaryType}`);
    score -= 10;
  }

  // 验证常见字段格式
  if (data.url && typeof data.url === "string") {
    try {
      new URL(data.url);
    } catch {
      errors.push("url 字段格式无效");
      score -= 5;
    }
  }

  if (data.image && typeof data.image === "string") {
    try {
      new URL(data.image);
    } catch {
      warnings.push("image 字段格式可能无效");
      score -= 3;
    }
  }

  // 验证日期格式
  if (data.datePublished && typeof data.datePublished === "string") {
    if (!isValidISODate(data.datePublished)) {
      warnings.push("datePublished 格式不符合 ISO 8601");
      score -= 3;
    }
  }

  if (data.dateModified && typeof data.dateModified === "string") {
    if (!isValidISODate(data.dateModified)) {
      warnings.push("dateModified 格式不符合 ISO 8601");
      score -= 3;
    }
  }

  return {
    type: primaryType,
    data,
    requiredFields,
    recommendedFields,
    errors,
    warnings,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * 验证 ISO 8601 日期格式
 */
function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.includes("-");
}

/**
 * 主分析函数：分析 HTML 中的所有 JSON-LD 数据
 */
export function analyzeJsonLd(html: string): JsonLdAnalysis {
  const scripts = extractJsonLdScripts(html);
  const globalErrors: string[] = [];
  const globalWarnings: string[] = [];
  const schemas: JsonLdSchema[] = [];
  const types: string[] = [];

  // 如果没有找到任何 JSON-LD 脚本
  if (scripts.length === 0) {
    return {
      exists: false,
      isValid: false,
      hasContext: false,
      hasType: false,
      types: [],
      schemas: [],
      errors: ["页面未包含 JSON-LD 结构化数据"],
      warnings: [],
      score: 0,
    };
  }

  let hasValidJson = false;
  let hasContext = false;
  let hasType = false;

  // 分析每个 JSON-LD 脚本
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (!script) continue;

    try {
      const data = JSON.parse(script);
      hasValidJson = true;

      // 处理 @graph 格式（多个 schema 在一个脚本中）
      if (data["@graph"] && Array.isArray(data["@graph"])) {
        for (const item of data["@graph"]) {
          const analysis = analyzeSchema(item);
          schemas.push(analysis);
          types.push(...(Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]]));
          if (item["@context"]) hasContext = true;
          if (item["@type"]) hasType = true;
        }
      } else {
        // 单个 schema
        const analysis = analyzeSchema(data);
        schemas.push(analysis);
        if (data["@type"]) {
          const schemaTypes = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
          types.push(...schemaTypes);
          hasType = true;
        }
        if (data["@context"]) hasContext = true;
      }
    } catch (error) {
      globalErrors.push(`JSON-LD 脚本 ${i + 1} 解析失败: JSON 格式无效`);
    }
  }

  // 计算整体评分
  let totalScore = 0;
  if (schemas.length > 0) {
    totalScore = schemas.reduce((sum, s) => sum + s.score, 0) / schemas.length;
  }

  // 收集所有错误和警告
  schemas.forEach((schema) => {
    globalErrors.push(...schema.errors);
    globalWarnings.push(...schema.warnings);
  });

  // 如果有多个 schema，但它们之间没有关联，给出提示
  if (schemas.length > 3) {
    globalWarnings.push(`检测到 ${schemas.length} 个独立的 JSON-LD 块，考虑合并以提高性能`);
  }

  const isValid = hasValidJson && hasContext && hasType && globalErrors.length === 0;

  return {
    exists: true,
    isValid,
    hasContext,
    hasType,
    types: [...new Set(types)], // 去重
    schemas,
    errors: [...new Set(globalErrors)], // 去重
    warnings: [...new Set(globalWarnings)], // 去重
    score: Math.round(totalScore),
  };
}

/**
 * 生成 JSON-LD 问题摘要（用于 buildIssueSummary）
 */
export interface JsonLdIssueSummary {
  jsonLdMissing: boolean;
  jsonLdInvalid: boolean;
  jsonLdIncomplete: boolean; // 有 JSON-LD 但缺少重要字段
  jsonLdTypes: string[]; // 检测到的类型列表
  jsonLdScore: number;
}

export function buildJsonLdSummary(analysis: JsonLdAnalysis): JsonLdIssueSummary {
  return {
    jsonLdMissing: !analysis.exists,
    jsonLdInvalid: analysis.exists && !analysis.isValid,
    jsonLdIncomplete: analysis.isValid && analysis.score < 70,
    jsonLdTypes: analysis.types,
    jsonLdScore: analysis.score,
  };
}
