export interface ThesisCheck {
  answer: "yes" | "partial" | "no" | "insufficient_data";
  summary: string;
  evidence: string;
  source: string;
}

export interface InvestmentThesis {
  q1_businessModel: ThesisCheck;
  q2_sectorOutlook: ThesisCheck;
  q3_marketShare: ThesisCheck;
  q4_growthVisibility: ThesisCheck;
  q5_structuralCapex: ThesisCheck;
  q6_operatingLeverage: ThesisCheck;
  managementTone: {
    classification: "confident" | "cautious" | "defensive";
    keyQuote: string;
    source: string;
  };
}

export interface ParameterEvidence {
  quote: string;
  source: string;
  link: string;
}

export interface ParameterKPI {
  label: string;
  value: string;
  context?: string;
  source: "PPT" | "Concall";
  link?: string;
}

export interface ParameterProject {
  name: string;
  kpis: { label: string; value: string }[];
}

export interface Parameter {
  tag: string;
  score: number;
  previousScore?: number;
  reasoning: string;
  evidence: ParameterEvidence[];
  kpis: ParameterKPI[];
  projects?: ParameterProject[];
}

export interface CompanyInsight {
  company: string;
  ticker: string;
  slug: string;
  quarter: string;
  previousQuarter?: string;
  compositeScore: number;
  previousCompositeScore?: number;
  verdict: { key: "buy" | "hold" | "weak"; label: string; emoji: string };
  overallSummary: string;
  investorTake: string;
  confidence: { display: string; rate: number };
  parameters: {
    capex: Parameter;
    revenueGrowth: Parameter;
    marginOutlook: Parameter;
  };
  thesis: InvestmentThesis;
  thesisPassed: number;
  thesisTotal: number;
  riskFactors: { severity: "HIGH" | "MEDIUM" | "LOW"; description: string }[];
  processedAt: string;
  price: number;
  priceChange: number;
  managementTone: "confident" | "cautious" | "defensive";
}
