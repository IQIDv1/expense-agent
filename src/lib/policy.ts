import type {
  PolicyFinding,
  PolicyRule,
  ReceiptExtractedData,
} from '@/types/domain';

export function runPolicy(
  extraction: ReceiptExtractedData,
  rules: PolicyRule[],
): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  for (const rule of rules) {
    const applies = rule.appliesTo || {};
    const matchCategory = applies.category
      ? (extraction.category || '').toLowerCase() === applies.category.toLowerCase()
      : true;
    const matchCity = applies.city
      ? (extraction.location?.city || '').toLowerCase() === applies.city.toLowerCase()
      : true;
    if (!(matchCategory && matchCity)) continue;

    if (
      rule.limit != null &&
      (extraction.amountTotal ?? Number.NEGATIVE_INFINITY) > rule.limit
    ) {
      findings.push({
        code: rule.code,
        severity: 'warn',
        message: `${rule.description} (limit ${rule.limit})`,
        evidence: `amount=${extraction.amountTotal}`,
      });
    }

    if (rule.requires?.receipt) {
      findings.push({
        code: `${rule.code}_RECEIPT_REQ`,
        severity: 'info',
        message: 'Receipt required; attached via upload.',
        evidence: '',
      });
    }
  }
  return findings;
}

export function statusFrom(findings: PolicyFinding[]): 'needs-info' | 'valid' | 'flagged' {
  if (findings.some((f) => f.severity === 'block')) return 'flagged';
  return 'valid';
}

