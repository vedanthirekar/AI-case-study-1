// Shapes of the packet as delivered. Field names follow the packet readme.

export type Scalar = number | string | boolean | null

export interface Position { x0: number; y0: number; x1: number; y1: number }

export interface ExtractedValue {
  id: string
  document_id: string
  page: number
  field: string
  label: string
  value: Scalar
  value_type: string
  text_as_read: string
  position: Position | null
  confidence: number
}

export interface DocPage { page: number; printed_content: string }

export interface Doc {
  id: string
  title: string
  document_type: string
  issuer: string
  belongs_to: string
  tax_year: number
  received_at: string
  uploaded_by: 'client' | 'firm'
  file_name: string
  page_count: number
  pages: DocPage[]
  marked_corrected?: boolean
  extraction: { status: 'extracted' | 'partial' | 'not_extracted'; values: number; reason: string | null }
}

export interface Line {
  key: string
  jurisdiction: 'federal' | 'california'
  form: string
  line: string
  label: string
  value: number | string
  rule: string
  inputs: string[]
  sources: string[]
  note?: string
}

export interface AssetYear { prior_accumulated?: number; depreciation_2025: number; accumulated_end?: number; difference_from_regular?: number }
export interface Asset {
  asset_id: string
  description: string
  activity: string
  cost: number
  land_value_not_depreciated: number | null
  placed_in_service: string
  method: string
  life_years: number
  federal: AssetYear
  california: AssetYear
  amt: AssetYear
  disposed: string | null
  disposition?: { date: string; sold_with: string; unrecaptured_1250_depreciation: number; section_1250_ordinary_recapture: number }
  sources: string[]
}

export interface Diagnostic { code: string; severity: 'info' | 'warning'; message: string; refs: string[] }
export interface LineChange { key: string; change: 'added' | 'changed' | 'removed'; old?: number | string; new?: number | string }

export interface FederalSummary { agi: number; taxable_income: number; total_tax: number; payments: number; balance_due: number; penalty: number }
export interface CaliforniaSummary { total_agi: number; ca_agi: number; total_tax: number; payments: number; balance_due: number; penalty: number }
export type Rate = { federal_per_dollar: number; california_per_dollar: number }

export interface ReturnVersion {
  version: string
  computed_at: string
  trigger: string
  documents_used: string[]
  documents_superseded: string[]
  summary: { federal: FederalSummary; california: CaliforniaSummary }
  tax_effect_rates: Record<string, Rate>
  carryovers_out: { federal: Record<string, number | null>; california: Record<string, unknown> }
  assets: Asset[]
  diagnostics: Diagnostic[]
  changes_from_previous: LineChange[]
  lines: Line[]
}

export interface Person {
  id: string; role: 'taxpayer' | 'spouse' | 'dependent'; name: string; ssn: string; dob: string
  occupation?: string; ip_pin?: string | null; phone?: string; email?: string
  relationship?: string; months_lived_with_you?: number; full_time_student?: boolean; note?: string; own_income?: string
}

export interface Staff {
  id: string; name: string
  role: 'preparer' | 'reviewer' | 'partner' | 'firm_administrator' | 'quality_reviewer'
  credential: string | null; sensitive_data_clearance: boolean; active_from: string; note?: string
}

export interface TimelineEvent { id: string; at: string; event: string; actor: string | null; detail: string | null; refs: string[] }
export interface QA { id: string; question: string; answer: string; answered_by: string; answered_at: string }
export interface Message { id: string; sent_at: string; from: string; to: string; text: string }
export interface CallNote { id: string; date: string; participants: string[]; notes: string[] }

export interface WhatIf {
  id: string; description: string; base_version: string; choices: Record<string, string>
  federal: { base: FederalSummary; alternative: FederalSummary; total_tax_change: number; penalty_change: number }
  california: { base: CaliforniaSummary; alternative: CaliforniaSummary; total_tax_change: number }
  changed_lines: LineChange[]
}

export interface Packet {
  packet: { name: string; version: string; generated: string; client_id: string }
  readme: { sections: Record<string, string>; reference_formats: Record<string, string>; [k: string]: unknown }
  household: {
    filing_status: string; tax_year: number; people: Person[]
    addresses: { from: string; to: string | null; address: string; type: string }[]
    residency: { state: string; from: string; to: string; status: string }[]
    bank_account_for_refund_or_payment: { routing: string; account: string; type: string; bank: string }
    prior_year_agi_for_esignature: number
    related_returns: { who: string; return: string; prepared_by: string; in_this_packet: string | boolean }[]
  }
  documents: Doc[]
  extracted_values: ExtractedValue[]
  client: { questionnaire: QA[]; messages: Message[]; call_notes: CallNote[] }
  firm: {
    name: string
    staff: Staff[]
    firm_identity: Record<string, unknown>
    client_users: { id: string; name: string; role: 'client' }[]
    assignment_at_start: { preparer: string; reviewer: string; partner: string }
    deadlines: { what: string; date: string }[]
    budget_hours: Record<string, number>
    starter_standards: {
      note: string
      verification_types: string[]
      variance_review: { compare_to: string; flag_if_change_over_percent: number; and_over_amount: number }
      review_levels: string[]
      rules: string[]
      required_steps: string[]
    }
  }
  prior_years: {
    return_2024: {
      prepared_by: string; filed: string; residency: string
      dependents: { name: string; ssn: string }[]
      lines: Record<string, number>; line_labels: Record<string, string>; line_sources: Record<string, string>
      notes: Record<string, string>
      [k: string]: unknown
    }
    prior_preparer_workpaper: { source_document: string; summary_memo: string; notes: string[]; open_items_left_by_prior_preparer: string[] }
    asset_records: unknown[]
    basis_records: Record<string, unknown[]>
    carryovers_into_2025: Record<string, unknown>
  }
  tax_agency_records: {
    irs_account_transcript_2025: { as_of: string; transactions: { date: string; code: string; description: string; amount: number | string }[] }[]
    ftb_account: { as_of: string; tax_year_2025_payments: { date: string; amount: number }[]; tax_year_2024_payments_after_filing: { date: string; amount: number; note: string }[] }
    notices: { id: string; agency: string; type: string; tax_year: number; dated: string; summary?: string; status?: string; response_due?: string; document: string; items_under_examination?: string[] }[]
    efile: { date: string; jurisdiction: string; submission_id: string; status: string; errors?: { code: string; message: string }[] }[]
  }
  timeline: TimelineEvent[]
  engine_reference: { parameters: Record<string, unknown>; rules: Record<string, string> }
  return_versions: ReturnVersion[]
  what_if: { alternatives: WhatIf[]; extension: Record<string, unknown> }
  planning_reference_2026: Record<string, unknown>
  post_filing_rates: Record<string, unknown>
  fx_rates: Record<string, Record<string, number>>
}
