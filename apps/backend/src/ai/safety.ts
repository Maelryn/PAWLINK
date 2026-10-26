/**
 * Safety override rules for PawLink AI.
 * Rules can ONLY raise urgency, NEVER lower it.
 * Keywords cover English, French, Arabic, and Algerian Darija.
 */

import type { AIInput, AIRaw } from './ai.provider';

export const URGENT_TAGS = [
  'trapped',
  'bleeding',
  'breathing',
  'fire',
  'burned',
  'poison',
  'seizure',
  'unconscious',
];

export const URGENT_KEYWORDS = [
  // French — bleeding, fire, trapped, breathing, poison + clear emergencies
  'saign',
  'saigne',
  'brûl',
  'brul',
  'piég',
  'coinc',
  'ne respire',
  'respire pas',
  'difficulte a respir',
  'difficulté à respir',
  'inconscient',
  'percut',
  'fractur',
  'empoison',
  'convuls',
  'renversé',
  'ecrase',
  'écrasé',
  'pilule',
  // English
  'bleed',
  'bleeding',
  'trapped',
  'not breathing',
  "can't breathe",
  'cannot breathe',
  'difficulty breathing',
  'unconscious',
  'hit by',
  'poison',
  'seizure',
  'convuls',
  'crushed',
  'fracture',
  'gasping',
  'collapsed',
  'pills',
  // Arabic & Algerian Darija
  'نزيف',
  'حريق',
  'محاصر',
  'تنفس',
  'حروق',
  'مسموم',
  'مبيدات',
  'ضربتو طوموبيل',
  'ضربته سيارة',
  'سحب سيارة',
  'فاقد الوعي',
  'تشنجات',
  'مكسور',
  'ما يتنفسش',
  'لا يتنفس',
  'يتخنق',
  'يرتجف',
  'يرتعش',
];

export const CONTAGIOUS_TAGS = ['eyes', 'sneezing', 'skin', 'itching', 'coughing'];

export const CONTAGIOUS_KEYWORDS = [
  'gale',
  'mange',
  'toux',
  'cough',
  'diarr',
  'vomi',
  'teigne',
  'سعال',
  'إسهال',
  'جرب',
  'مرض معدي',
];

export const MONITOR_TAGS = [
  'lost',
  'stressed',
  'thin',
  'dehydrated',
  'limping',
  'not-eating',
  'heat',
  'young',
  'abandoned',
  'injured',
  ...CONTAGIOUS_TAGS,
];

const MINOR_INJURY_RE =
  /minor scratch|minor scratches|slightly swollen|légèrement|legerement|boite|boiter|خدش|خدوش/i;

function hasLatinWordPrefix(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-zàâäéèêëïîôùûüçA-Z])${escaped}`, 'i').test(text);
}

function hasUrgentKeyword(normalizedText: string, originalText: string): boolean {
  const haystack = `${normalizedText} ${originalText}`;

  if (/(?:^|[^a-z])fire(?!work)/i.test(haystack) || /\bfeu\b|\bincendie\b/.test(haystack)) {
    return true;
  }
  if (/(?:^|[^a-z])burn/i.test(haystack)) {
    return true;
  }
  if (/(?:^|[^a-z])blood\b|(?:^|[^a-zàâäéèêëïîôùûüç])sang(?:s|lant|lante)?\b/i.test(haystack)) {
    return true;
  }
  if (/\bbreath/i.test(haystack) || /respir/i.test(haystack)) {
    return true;
  }
  if (/\bstuck\b/i.test(haystack)) {
    return true;
  }
  if (/(?:^|\s|[وفالب]|ال)(دم|دماء)(?:\s|$|[اًه،,.])/u.test(haystack) || haystack.includes('نار')) {
    return true;
  }

  return URGENT_KEYWORDS.some((kw) => {
    if (/[\u0600-\u06FF]/.test(kw)) {
      return haystack.includes(kw);
    }
    return hasLatinWordPrefix(normalizedText, kw.toLowerCase());
  });
}

/**
 * Checks if input triggers urgent safety rules
 */
export function isUrgentByRule(text: string, tags: string[] = []): boolean {
  const originalText = String(text ?? '');
  const normalizedText = originalText.toLowerCase();
  const normalizedTags = (tags ?? []).map((t) => String(t).toLowerCase());

  const hasUrgentTag = normalizedTags.some((tag) => URGENT_TAGS.includes(tag));
  if (hasUrgentTag) return true;

  if (normalizedTags.includes('injured') && !MINOR_INJURY_RE.test(originalText)) {
    return true;
  }

  return hasUrgentKeyword(normalizedText, originalText);
}

/**
 * Checks if input suggests a contagious condition
 */
export function isContagiousByRule(text: string, tags: string[] = []): boolean {
  const normalizedText = String(text ?? '').toLowerCase();
  const normalizedTags = (tags ?? []).map((t) => String(t).toLowerCase());

  const hasContagiousTag = normalizedTags.some((tag) => CONTAGIOUS_TAGS.includes(tag));
  const hasContagiousKeyword = CONTAGIOUS_KEYWORDS.some((kw) =>
    normalizedText.includes(kw.toLowerCase()),
  );

  return hasContagiousTag || hasContagiousKeyword;
}

/**
 * Checks if input matches monitoring symptoms
 */
export function isMonitoringByRule(text: string, tags: string[] = []): boolean {
  const normalizedText = String(text ?? '').toLowerCase();
  const normalizedTags = (tags ?? []).map((t) => String(t).toLowerCase());

  const hasMonitorTag = normalizedTags.some((tag) => MONITOR_TAGS.includes(tag));
  const monitorWords = [
    'limp',
    'boit',
    'thin',
    'dehydr',
    'lost',
    'abandon',
    'not eating',
    'ne mange',
    'weak',
    'faible',
    'scratch',
    'stress',
    'cough',
    'itch',
    'diarrhea',
    'young',
    'kitten',
    'puppy',
    'scared',
    'frightened',
    'vague',
    'not sure',
    'pas sûr',
    'pas sur',
    'near the school',
    'près de',
    'ضعيف',
    'وحيد',
    'خائف',
    'مش قاعد ياكل',
  ];
  const hasMonitorKeyword = monitorWords.some((kw) => normalizedText.includes(kw.toLowerCase()));

  return hasMonitorTag || hasMonitorKeyword || isContagiousByRule(text, tags);
}

/**
 * Applies safety rules to an AI result.
 * Can escalate to "urgent" but never downgrades.
 */
export function applySafetyRules(input: AIInput, result: AIRaw): AIRaw {
  const text = input.description ?? '';
  const tags = input.conditionTags ?? [];

  const forcedUrgentByRule = isUrgentByRule(text, tags);
  const contagiousRule = isContagiousByRule(text, tags);

  let updatedUrgency = result.urgency === 'stable' ? 'non_urgent' : result.urgency;
  let forcedFlag = Boolean(result.forced_urgent_by_rule || result.forcedUrgentByRule);

  if (forcedUrgentByRule) {
    updatedUrgency = 'urgent';
    forcedFlag = true;
  }

  const inferredFlags = inferRedFlags(text, tags);
  const combinedFlags = [...new Set([...(result.red_flags ?? []), ...inferredFlags])];

  const hazards = [...(result.hazards ?? [])];
  if (contagiousRule && !hazards.includes('contagion_risk')) {
    hazards.push('contagion_risk');
  }

  if (updatedUrgency === 'urgent' && (!result.needs || result.needs.length === 0)) {
    return {
      ...result,
      urgency: updatedUrgency,
      confidence: result.confidence === 'low' && forcedUrgentByRule ? 'medium' : result.confidence,
      red_flags: combinedFlags,
      hazards,
      needs: ['veterinarian'],
      forced_urgent_by_rule: forcedFlag,
      forcedUrgentByRule: forcedFlag,
    };
  }

  return {
    ...result,
    urgency: updatedUrgency,
    confidence: result.confidence === 'low' && forcedUrgentByRule ? 'medium' : result.confidence,
    red_flags: combinedFlags,
    hazards,
    forced_urgent_by_rule: forcedFlag,
    forcedUrgentByRule: forcedFlag,
  };
}

/** Infer red flags from text keywords and tags */
function inferRedFlags(text: string, tags: string[] = []): string[] {
  const str = `${String(text ?? '')} ${(tags ?? []).join(' ')}`.toLowerCase();
  const flags: string[] = [];

  if (
    /bleed|blood|saign|\bsang\b|نزيف|(?:^|\s|[وفالب]|ال)(دم|دماء)/u.test(str) ||
    tags.includes('bleeding')
  ) {
    flags.push('heavy_bleeding');
  }
  if (
    /breath|respir|تنفس|يتخنق|ما يتنفسش|لا يتنفس|gasping/.test(str) ||
    tags.includes('breathing')
  ) {
    flags.push('breathing_problem');
  }
  if (/unresponsive|unconscious|inconscient|فاقد الوعي|collapse/.test(str) || tags.includes('unconscious')) {
    flags.push('unresponsive');
  }
  if (/seiz|convuls|تشنج/.test(str) || tags.includes('seizure')) flags.push('seizure');
  if (/poison|toxique|empoison|مسموم|تسمم|pilule|pills|مبيدات/.test(str) || tags.includes('poison')) {
    flags.push('suspected_poisoning');
  }
  if (/(?:^|[^a-z])fire(?!work)|smoke|\bfeu\b|incendie|حريق|\bنار\b/.test(str) || tags.includes('fire')) {
    flags.push('smoke_exposure');
  }
  if (/burn|brûl|brul|حروق/.test(str) || tags.includes('burned')) flags.push('burns');
  if (/trapped|stuck|coinc|piég|محاصر/.test(str) || tags.includes('trapped')) flags.push('trapped');
  if (
    /hit by|renversé|percut|accident|écrasé|ecrase|ضربتو|ضربته|سحب سيارة|fractur|مكسور/.test(str)
  ) {
    flags.push('major_trauma');
  }

  return flags;
}
