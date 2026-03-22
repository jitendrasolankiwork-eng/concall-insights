import { CompanyInsight } from "@/types/portfolio";

export const mockCompanies: CompanyInsight[] = [
  {
    company: "Manorama Industries",
    ticker: "MANORAMA",
    slug: "manorama-industries",
    quarter: "Q3 FY25",
    previousQuarter: "Q2 FY25",
    compositeScore: 4.4,
    previousCompositeScore: 5.0,
    verdict: { key: "buy", label: "STRONG BUY", emoji: "🟢" },
    overallSummary:
      "Manorama Industries delivered a strong Q3 FY25 with revenue growth of 38% YoY to ₹325 Cr, driven by specialty fats expansion and new client acquisitions. EBITDA margins remained healthy at 27.1%. The company reiterated its ₹1,300 Cr revenue guidance for FY26 and announced a ₹460 Cr capex plan over 2–3 years for capacity expansion.",
    investorTake:
      "Strong execution continues. Revenue guidance intact, margins stable, and capex signals long-term growth commitment. Maintain position.",
    confidence: { display: "100% verified", rate: 100 },
    price: 847.5,
    priceChange: 2.3,
    managementTone: "confident",
    thesisPassed: 5,
    thesisTotal: 6,
    parameters: {
      capex: {
        tag: "Moderate Expansion",
        score: 4,
        previousScore: 5,
        reasoning:
          "Manorama has committed ₹460 Cr over 2–3 years, primarily for a new specialty fats plant in Kandla SEZ. While the capex plan is aggressive, it's partially debt-funded which introduces execution risk. The score drops from 5 to 4 due to the shift from fully internal accruals to partial debt financing.",
        evidence: [
          {
            quote:
              "We are investing ₹460 crores over the next 2 to 3 years to expand our specialty fats capacity by 75,000 MT per annum.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
          {
            quote:
              "The Kandla SEZ project will be funded through a mix of internal accruals and term loans.",
            source: "Q3 FY25 Investor Presentation",
            link: "#",
          },
        ],
        kpis: [
          { label: "Total Capex", value: "₹460 Cr", context: "over 2–3 years", source: "PPT", link: "#" },
          { label: "New Capacity", value: "75,000 MT/yr", source: "PPT", link: "#" },
          { label: "Location", value: "Kandla SEZ", source: "Concall" },
          { label: "Funding", value: "Internal + Debt", source: "Concall" },
        ],
        projects: [
          {
            name: "Kandla SEZ Specialty Fats Plant",
            kpis: [
              { label: "Capacity", value: "75,000 MT/yr" },
              { label: "Investment", value: "₹120 Cr" },
              { label: "Status", value: "Planned" },
            ],
          },
          {
            name: "Varanasi Processing Unit",
            kpis: [
              { label: "Capacity", value: "30,000 MT/yr" },
              { label: "Investment", value: "₹80 Cr" },
              { label: "Status", value: "Under Construction" },
            ],
          },
        ],
      },
      revenueGrowth: {
        tag: "Strong Growth",
        score: 5,
        reasoning:
          "Revenue grew 38% YoY to ₹325 Cr in Q3 FY25. The company has guided for ₹1,300 Cr revenue in FY26, implying continued strong momentum. New client wins in the FMCG segment and geographic expansion into Middle East markets are key drivers.",
        evidence: [
          {
            quote:
              "Our revenue for Q3 FY25 stood at ₹325 crores, a growth of 38% year-on-year.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "Q3 Revenue", value: "₹325 Cr", context: "38% YoY", source: "PPT", link: "#" },
          { label: "FY26 Guidance", value: "₹1,300 Cr", source: "Concall" },
          { label: "New Clients", value: "8 FMCG brands", source: "PPT", link: "#" },
        ],
      },
      marginOutlook: {
        tag: "Stable",
        score: 4,
        previousScore: 5,
        reasoning:
          "EBITDA margin at 27.1% is healthy but slightly below Q2's 28.5% due to input cost pressures in palm oil derivatives. Management expects margins to recover as new capacity comes online with better economies of scale.",
        evidence: [
          {
            quote:
              "Our EBITDA margin for the quarter was 27.1%, slightly lower than last quarter due to temporary input cost pressures.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "EBITDA Margin", value: "27.1%", context: "vs 28.5% in Q2", source: "PPT", link: "#" },
          { label: "PAT Margin", value: "18.2%", source: "PPT", link: "#" },
          { label: "Gross Margin", value: "42.3%", source: "Concall" },
        ],
      },
    },
    thesis: {
      q1_businessModel: {
        answer: "yes",
        summary: "Asset-light specialty fats model with high barriers to entry",
        evidence:
          "Manorama operates in the niche specialty fats segment with proprietary formulations that are difficult to replicate. Customer switching costs are high due to FDA/FSSAI certifications required for each formulation.",
        source: "Q3 FY25 Investor Presentation",
      },
      q2_sectorOutlook: {
        answer: "yes",
        summary: "Specialty fats demand growing 15-20% annually in India",
        evidence:
          "The Indian specialty fats market is growing at 15-20% CAGR driven by increasing processed food consumption and import substitution.",
        source: "Q3 FY25 Investor Presentation",
      },
      q3_marketShare: {
        answer: "yes",
        summary: "Dominant player with ~35% market share in specialty fats",
        evidence:
          "Company commands approximately 35% of the organized specialty fats market in India.",
        source: "Q3 FY25 Concall",
      },
      q4_growthVisibility: {
        answer: "yes",
        summary: "Clear revenue guidance of ₹1,300 Cr for FY26",
        evidence:
          "Management has provided clear guidance of ₹1,300 crores revenue for FY26 backed by order book visibility and new client wins.",
        source: "Q3 FY25 Concall",
      },
      q5_structuralCapex: {
        answer: "yes",
        summary: "₹460 Cr capex plan demonstrates long-term commitment",
        evidence:
          "The ₹460 crore capex plan over 2-3 years for Kandla SEZ and Varanasi units shows structural growth intent.",
        source: "Q3 FY25 Investor Presentation",
      },
      q6_operatingLeverage: {
        answer: "partial",
        summary: "Operating leverage visible but partially offset by debt-funded capex",
        evidence:
          "While new capacity will drive operating leverage, the shift to partial debt funding introduces interest cost headwinds that may partially offset operating leverage benefits.",
        source: "Q3 FY25 Concall",
      },
      managementTone: {
        classification: "confident",
        keyQuote:
          "We are very confident of achieving our ₹1,300 crore revenue target for FY26. Our order book visibility gives us strong conviction.",
        source: "Q3 FY25 Concall",
      },
    },
    riskFactors: [
      { severity: "HIGH", description: "Palm oil price volatility could compress margins in H1 FY26" },
      { severity: "MEDIUM", description: "Debt-funded capex introduces execution and interest cost risk" },
      { severity: "LOW", description: "Customer concentration — top 5 clients contribute 45% of revenue" },
    ],
    processedAt: "19 Mar 2026",
  },
  {
    company: "Eternal (Zomato)",
    ticker: "ETERNAL",
    slug: "zomato",
    quarter: "Q3 FY25",
    previousQuarter: "Q2 FY25",
    compositeScore: 4.7,
    previousCompositeScore: 4.7,
    verdict: { key: "buy", label: "STRONG BUY", emoji: "🟢" },
    overallSummary:
      "Eternal (formerly Zomato) delivered an exceptional Q3 FY25 with Blinkit growing 121% YoY. The quick commerce segment is approaching profitability while food delivery continues to generate strong cash flows. Hyperpure and Going-out segments also showed healthy traction.",
    investorTake:
      "Blinkit's hypergrowth trajectory and path to profitability make this a compelling structural story. The quick commerce TAM expansion thesis is playing out faster than expected.",
    confidence: { display: "100% verified", rate: 100 },
    price: 234.5,
    priceChange: -0.8,
    managementTone: "cautious",
    thesisPassed: 3,
    thesisTotal: 6,
    parameters: {
      capex: {
        tag: "Aggressive Expansion",
        score: 5,
        reasoning:
          "Blinkit is aggressively expanding dark stores — 639 stores now with a target of 1,000 by FY25 end. Investment in warehousing infrastructure and technology is substantial but well-funded by food delivery profits.",
        evidence: [
          {
            quote:
              "We opened 115 new dark stores in Q3, taking our total to 639. We remain on track for 1,000 stores by March 2025.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "Dark Stores", value: "639", context: "target 1,000", source: "PPT", link: "#" },
          { label: "New Stores Q3", value: "115", source: "PPT", link: "#" },
          { label: "Avg Store Size", value: "3,500 sq ft", source: "Concall" },
        ],
      },
      revenueGrowth: {
        tag: "Hypergrowth",
        score: 5,
        reasoning:
          "Blinkit GOV grew 121% YoY while food delivery grew 17% YoY. Consolidated revenue grew 68% YoY to ₹5,405 Cr. The quick commerce segment is now a significant revenue contributor.",
        evidence: [
          {
            quote: "Blinkit GOV grew 121% year-on-year to ₹6,800 crores in Q3 FY25.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "Blinkit GOV", value: "₹6,800 Cr", context: "121% YoY", source: "PPT", link: "#" },
          { label: "Food Delivery GOV", value: "₹9,260 Cr", context: "17% YoY", source: "PPT", link: "#" },
          { label: "Revenue", value: "₹5,405 Cr", context: "68% YoY", source: "PPT", link: "#" },
        ],
      },
      marginOutlook: {
        tag: "Improving",
        score: 4,
        reasoning:
          "Adjusted EBITDA turned positive at ₹150 Cr. Food delivery EBITDA margins are strong at 5.5% of GOV. Blinkit losses narrowing rapidly — expected to break even by Q1 FY26.",
        evidence: [
          {
            quote:
              "Our adjusted EBITDA for Q3 was positive at ₹150 crores. Blinkit contribution margin improved to -0.5% from -2.1% last quarter.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "Adj. EBITDA", value: "₹150 Cr", context: "positive", source: "PPT", link: "#" },
          { label: "Food EBITDA %", value: "5.5% of GOV", source: "PPT", link: "#" },
          { label: "Blinkit Contribution", value: "-0.5%", context: "vs -2.1% QoQ", source: "Concall" },
        ],
      },
    },
    thesis: {
      q1_businessModel: {
        answer: "yes",
        summary: "Platform business with strong network effects and multi-vertical expansion",
        evidence: "Zomato/Eternal operates a platform model across food delivery, quick commerce, and dining out with strong network effects.",
        source: "Q3 FY25 Investor Presentation",
      },
      q2_sectorOutlook: {
        answer: "yes",
        summary: "Quick commerce TAM expanding rapidly beyond groceries",
        evidence: "Quick commerce is expanding into electronics, beauty, and pharmacy — TAM is 5-10x larger than initially estimated.",
        source: "Q3 FY25 Concall",
      },
      q3_marketShare: {
        answer: "partial",
        summary: "Strong in food delivery but Blinkit faces intense competition",
        evidence: "Blinkit is #2 in quick commerce behind Zepto in key metros. Swiggy Instamart is also aggressively expanding.",
        source: "Q3 FY25 Concall",
      },
      q4_growthVisibility: {
        answer: "no",
        summary: "No explicit revenue guidance provided by management",
        evidence: "Management declined to provide specific revenue guidance, stating they focus on unit economics improvement.",
        source: "Q3 FY25 Concall",
      },
      q5_structuralCapex: {
        answer: "partial",
        summary: "Heavy dark store expansion but sustainability of capex intensity unclear",
        evidence: "115 new stores in one quarter is aggressive. Unclear if this pace is sustainable without diluting returns.",
        source: "Q3 FY25 Investor Presentation",
      },
      q6_operatingLeverage: {
        answer: "no",
        summary: "Operating leverage yet to be demonstrated at scale",
        evidence: "While EBITDA turned positive, the company is still investing heavily. True operating leverage will be visible only when Blinkit reaches steady-state.",
        source: "Q3 FY25 Concall",
      },
      managementTone: {
        classification: "cautious",
        keyQuote: "We are focused on building for the long term. Short-term margins may fluctuate as we invest in growth.",
        source: "Q3 FY25 Concall",
      },
    },
    riskFactors: [
      { severity: "HIGH", description: "Intense competition in quick commerce from Zepto and Swiggy Instamart" },
      { severity: "HIGH", description: "No clear path to Blinkit profitability timeline despite improving unit economics" },
      { severity: "MEDIUM", description: "Regulatory risk around dark store zoning and gig worker classification" },
    ],
    processedAt: "19 Mar 2026",
  },
  {
    company: "HDFC Bank",
    ticker: "HDFCBANK",
    slug: "hdfc-bank",
    quarter: "Q3 FY25",
    previousQuarter: "Q2 FY25",
    compositeScore: 2.7,
    previousCompositeScore: 3.0,
    verdict: { key: "hold", label: "HOLD", emoji: "🟡" },
    overallSummary:
      "HDFC Bank's Q3 FY25 showed continued NIM pressure post-merger with HDFC Ltd. While loan growth was healthy at 14% YoY, net interest margins compressed to 3.4% from 3.65% pre-merger levels. The merger integration is progressing but headwinds remain.",
    investorTake:
      "HOLD — the merger integration overhang continues. NIM recovery is the key monitorable. Wait for 2-3 quarters for merger synergies to reflect in numbers.",
    confidence: { display: "100% verified", rate: 100 },
    price: 1680,
    priceChange: -1.2,
    managementTone: "cautious",
    thesisPassed: 4,
    thesisTotal: 6,
    parameters: {
      capex: {
        tag: "Branch Expansion",
        score: 3,
        reasoning:
          "HDFC Bank is expanding its branch network post-merger but at a measured pace. The focus is on rationalizing overlapping HDFC Ltd branches rather than aggressive greenfield expansion.",
        evidence: [
          {
            quote: "We added 150 branches in Q3, taking our total to 8,200. We are rationalizing about 200 overlapping HDFC Ltd branches.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "Total Branches", value: "8,200", source: "PPT", link: "#" },
          { label: "New Branches Q3", value: "150", source: "PPT", link: "#" },
          { label: "Rationalized", value: "200 branches", source: "Concall" },
        ],
      },
      revenueGrowth: {
        tag: "Moderate",
        score: 3,
        reasoning:
          "Loan book grew 14% YoY but NII growth was muted at 8% due to NIM compression. Fee income growth was healthy at 20% YoY driven by cross-selling to HDFC Ltd customers.",
        evidence: [
          {
            quote: "Our loan book grew 14% year-on-year. However, NII growth was 8% due to ongoing NIM normalization.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "Loan Growth", value: "14% YoY", source: "PPT", link: "#" },
          { label: "NII Growth", value: "8% YoY", source: "PPT", link: "#" },
          { label: "Fee Income", value: "20% YoY", source: "Concall" },
        ],
      },
      marginOutlook: {
        tag: "Under Pressure",
        score: 2,
        previousScore: 3,
        reasoning:
          "NIM at 3.4% continues to decline from pre-merger levels of 3.65%. The high-cost HDFC Ltd borrowings are being gradually replaced but this will take 2-3 more quarters. Credit costs remain elevated at 0.55%.",
        evidence: [
          {
            quote: "Our NIM for Q3 was 3.4%, down 10 bps sequentially. We expect NIM to recover to 3.5% by Q2 FY26 as we replace high-cost borrowings.",
            source: "Q3 FY25 Concall",
            link: "#",
          },
        ],
        kpis: [
          { label: "NIM", value: "3.4%", context: "vs 3.5% QoQ", source: "PPT", link: "#" },
          { label: "Credit Cost", value: "0.55%", source: "PPT", link: "#" },
          { label: "CASA Ratio", value: "38.5%", context: "vs 40.2% QoQ", source: "Concall" },
        ],
      },
    },
    thesis: {
      q1_businessModel: {
        answer: "yes",
        summary: "Largest private bank with strong deposit franchise and diversified lending",
        evidence: "HDFC Bank has the largest private sector banking franchise in India with ₹25 lakh crore balance sheet.",
        source: "Q3 FY25 Investor Presentation",
      },
      q2_sectorOutlook: {
        answer: "yes",
        summary: "Indian banking sector well-positioned with credit growth at 15%+",
        evidence: "System credit growth remains healthy at 15%+ supported by economic growth and formalization.",
        source: "Q3 FY25 Concall",
      },
      q3_marketShare: {
        answer: "yes",
        summary: "Market leader in private banking with growing share",
        evidence: "HDFC Bank's market share in advances increased to 11.2% post-merger.",
        source: "Q3 FY25 Investor Presentation",
      },
      q4_growthVisibility: {
        answer: "yes",
        summary: "14% loan growth guidance maintained for FY25",
        evidence: "Management reiterated its 14% loan growth guidance and expects to grow in line with system credit growth.",
        source: "Q3 FY25 Concall",
      },
      q5_structuralCapex: {
        answer: "partial",
        summary: "Technology investments ongoing but branch expansion is measured",
        evidence: "Tech spend at 3% of revenue. Branch expansion is focused on rationalization rather than aggressive growth.",
        source: "Q3 FY25 Investor Presentation",
      },
      q6_operatingLeverage: {
        answer: "no",
        summary: "Operating leverage negative due to merger integration costs",
        evidence: "Cost-to-income ratio increased to 42% from 39% pre-merger. Integration costs expected to persist for 2-3 quarters.",
        source: "Q3 FY25 Concall",
      },
      managementTone: {
        classification: "cautious",
        keyQuote: "The merger integration is progressing as planned. NIM recovery will be gradual and we expect normalization by H1 FY26.",
        source: "Q3 FY25 Concall",
      },
    },
    riskFactors: [
      { severity: "HIGH", description: "NIM compression may persist longer than expected if rate cuts accelerate" },
      { severity: "MEDIUM", description: "CASA ratio decline impacting cost of funds" },
      { severity: "MEDIUM", description: "Merger integration costs keeping cost-to-income elevated" },
      { severity: "LOW", description: "Regulatory scrutiny on unsecured lending exposure" },
    ],
    processedAt: "19 Mar 2026",
  },
];
