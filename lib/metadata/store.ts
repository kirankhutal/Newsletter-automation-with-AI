// lib/metadata/store.ts
// Metadata storage for draft history and analytics

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface DraftMetadata {
  id: string;
  week: string;
  weekDescription: string;
  title: string;
  subtitle: string;
  wordCount: number;
  linkCount: number;
  pillarsFound: string[];
  qualityChecks: {
    subjectLength: boolean;
    wordCount: boolean;
    linkCount: boolean;
    hasPillars: boolean;
    validHTML: boolean;
  };
  sourceEmailCount: number;
  generatedAt: string;
  sentAt: string | null;
  llmCost: number;
  skillVersion: string;
  beehiivPostId: string | null;
  beehiivUrl: string | null;
  dryRun: boolean;
}

export interface FeedbackEntry {
  draftId: string;
  week: string;
  action: 'sent' | 'rejected' | 'edited';
  notes: string;
  timestamp: string;
}

const METADATA_DIR = join(process.cwd(), 'lib/metadata');
const DRAFTS_FILE = join(METADATA_DIR, 'drafts.json');
const FEEDBACK_FILE = join(METADATA_DIR, 'feedback.json');

/**
 * Ensure metadata directory exists
 */
function ensureMetadataDir() {
  if (!existsSync(METADATA_DIR)) {
    mkdirSync(METADATA_DIR, { recursive: true });
  }
}

/**
 * Load all draft metadata
 */
export function loadDrafts(): DraftMetadata[] {
  ensureMetadataDir();
  if (!existsSync(DRAFTS_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(DRAFTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading drafts:', error);
    return [];
  }
}

/**
 * Save draft metadata
 */
export function saveDraft(draft: DraftMetadata): void {
  ensureMetadataDir();
  const drafts = loadDrafts();
  
  // Check if draft for this week already exists
  const existingIndex = drafts.findIndex(d => d.week === draft.week);
  if (existingIndex >= 0) {
    drafts[existingIndex] = draft;
  } else {
    drafts.push(draft);
  }
  
  // Sort by week (newest first)
  drafts.sort((a, b) => b.week.localeCompare(a.week));
  
  writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2), 'utf-8');
}

/**
 * Get draft by week identifier
 */
export function getDraftByWeek(week: string): DraftMetadata | null {
  const drafts = loadDrafts();
  return drafts.find(d => d.week === week) || null;
}

/**
 * Get most recent draft
 */
export function getLatestDraft(): DraftMetadata | null {
  const drafts = loadDrafts();
  return drafts.length > 0 ? drafts[0] : null;
}

/**
 * Load all feedback entries
 */
export function loadFeedback(): FeedbackEntry[] {
  ensureMetadataDir();
  if (!existsSync(FEEDBACK_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading feedback:', error);
    return [];
  }
}

/**
 * Save feedback entry
 */
export function saveFeedback(feedback: FeedbackEntry): void {
  ensureMetadataDir();
  const entries = loadFeedback();
  entries.push(feedback);
  
  // Sort by timestamp (newest first)
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  
  writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * Get analytics summary
 */
export function getAnalytics() {
  const drafts = loadDrafts();
  const feedback = loadFeedback();
  
  if (drafts.length === 0) {
    return {
      totalDrafts: 0,
      successRate: 0,
      avgCost: 0,
      avgWordCount: 0,
      qualityPassRate: 0,
    };
  }
  
  const totalDrafts = drafts.length;
  const successfulDrafts = drafts.filter(d => d.qualityChecks.subjectLength && d.qualityChecks.wordCount && d.qualityChecks.linkCount && d.qualityChecks.hasPillars && d.qualityChecks.validHTML).length;
  const totalCost = drafts.reduce((sum, d) => sum + d.llmCost, 0);
  const totalWords = drafts.reduce((sum, d) => sum + d.wordCount, 0);
  
  const sentCount = feedback.filter(f => f.action === 'sent').length;
  
  return {
    totalDrafts,
    successRate: (successfulDrafts / totalDrafts) * 100,
    avgCost: totalCost / totalDrafts,
    avgWordCount: Math.round(totalWords / totalDrafts),
    qualityPassRate: (successfulDrafts / totalDrafts) * 100,
    sentCount,
    sentRate: totalDrafts > 0 ? (sentCount / totalDrafts) * 100 : 0,
  };
}
