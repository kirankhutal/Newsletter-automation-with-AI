// lib/utils/quality-checks.ts
// Content validation functions for newsletter quality gates

export interface QualityCheckResult {
  passed: boolean;
  checks: {
    subjectLength: boolean;
    wordCount: boolean;
    linkCount: boolean;
    hasPillars: boolean;
    validHTML: boolean;
  };
  details: {
    subjectLength: number;
    wordCount: number;
    linkCount: number;
    foundPillars: string[];
    htmlErrors: string[];
  };
}

/**
 * Validate newsletter content against quality gates
 */
export function validateContent(
  title: string,
  content: string,
  pillars: string[] = ['AI Innovation', 'Banking Tech', 'Regulation', 'Market Trends']
): QualityCheckResult {
  const checks = {
    subjectLength: title.length >= 20 && title.length <= 60,
    wordCount: countWords(content) >= 800,
    linkCount: countLinks(content) >= 5,
    hasPillars: checkPillars(content, pillars),
    validHTML: validateHTML(content),
  };

  const details = {
    subjectLength: title.length,
    wordCount: countWords(content),
    linkCount: countLinks(content),
    foundPillars: findPillars(content, pillars),
    htmlErrors: getHTMLErrors(content),
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    details,
  };
}

/**
 * Count words in HTML content (strips tags first)
 */
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count links in HTML content
 */
function countLinks(html: string): number {
  const matches = html.match(/href\s*=\s*["'][^"']*["']/gi);
  return matches ? matches.length : 0;
}

/**
 * Check if all pillars are mentioned in content
 */
function checkPillars(content: string, pillars: string[]): boolean {
  const lowerContent = content.toLowerCase();
  return pillars.every(pillar => {
    const lowerPillar = pillar.toLowerCase();
    // Check for pillar name or key terms
    return lowerContent.includes(lowerPillar) || 
           lowerContent.includes(pillar.split(' ')[0].toLowerCase());
  });
}

/**
 * Find which pillars are present in content
 */
function findPillars(content: string, pillars: string[]): string[] {
  const lowerContent = content.toLowerCase();
  return pillars.filter(pillar => {
    const lowerPillar = pillar.toLowerCase();
    return lowerContent.includes(lowerPillar) || 
           lowerContent.includes(pillar.split(' ')[0].toLowerCase());
  });
}

/**
 * Basic HTML validation
 */
function validateHTML(html: string): boolean {
  const errors = getHTMLErrors(html);
  return errors.length === 0;
}

/**
 * Get HTML validation errors
 */
function getHTMLErrors(html: string): string[] {
  const errors: string[] = [];
  
  // Check for unclosed tags (basic check)
  const openTags = html.match(/<([a-z][a-z0-9]*)\b[^>]*>/gi) || [];
  const closeTags = html.match(/<\/([a-z][a-z0-9]*)>/gi) || [];
  
  const openTagNames = openTags.map(tag => {
    const match = tag.match(/<([a-z][a-z0-9]*)/i);
    return match ? match[1].toLowerCase() : '';
  }).filter(tag => !['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tag));
  
  const closeTagNames = closeTags.map(tag => {
    const match = tag.match(/<\/([a-z][a-z0-9]*)/i);
    return match ? match[1].toLowerCase() : '';
  });
  
  // Simple check: count of open vs close tags
  const tagCounts: Record<string, number> = {};
  openTagNames.forEach(tag => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });
  closeTagNames.forEach(tag => {
    tagCounts[tag] = (tagCounts[tag] || 0) - 1;
  });
  
  Object.entries(tagCounts).forEach(([tag, count]) => {
    if (count !== 0) {
      errors.push(`Mismatched <${tag}> tags (difference: ${count})`);
    }
  });
  
  // Check for broken links
  const brokenLinks = html.match(/href\s*=\s*["']\s*["']/gi);
  if (brokenLinks && brokenLinks.length > 0) {
    errors.push(`Found ${brokenLinks.length} empty href attributes`);
  }
  
  return errors;
}

/**
 * Calculate similarity score between two texts (0-1)
 * Simple word overlap metric
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1.toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
  
  const words2 = new Set(
    text2.toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Check if content is too similar to previous content
 */
export function isTooSimilar(
  newContent: string,
  previousContent: string,
  threshold: number = 0.4
): boolean {
  const similarity = calculateSimilarity(newContent, previousContent);
  return similarity > threshold;
}
