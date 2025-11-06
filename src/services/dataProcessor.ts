import { VectorSearchService } from './vectorSearch';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentParser, ParsedDocument } from './documentParser';

export interface DataStats {
  totalDocuments: number;
  totalChunks: number;
  documentTypes: Record<string, number>;
  lastUpdated: string;
  structuredRecords: {
    companies: number;
    transactions: number;
    customers: number;
  };
}

export class DataProcessor {
  private vectorSearch: VectorSearchService | null = null;
  private documentParser: DocumentParser;
  private stats: DataStats;

  constructor() {
    this.documentParser = new DocumentParser();
    this.stats = {
      totalDocuments: 0,
      totalChunks: 0,
      documentTypes: {},
      lastUpdated: new Date().toISOString(),
      structuredRecords: {
        companies: 0,
        transactions: 0,
        customers: 0
      }
    };
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing data processor with async pipeline...');

    // Initialize vector search if not already set
    if (!this.vectorSearch) {
      this.vectorSearch = new VectorSearchService();
      await this.vectorSearch.initialize();
    }

    // Create data directories if they don't exist
    await this.ensureDirectories();

    console.log('✅ Data processor initialized');
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = ['data/raw', 'data/processed', 'data/sample'];

    await Promise.all(
      dirs.map(async (dir) => {
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch (error) {
          // Directory might already exist
        }
      })
    );
  }

  async processDocument(doc: ParsedDocument): Promise<void> {
    if (!this.vectorSearch) {
      throw new Error('Data processor not initialized');
    }

    // Add to vector store
    await this.vectorSearch.addDocument(doc);

    // Update statistics
    this.stats.totalDocuments++;
    this.stats.totalChunks += doc.chunks.length;

    const docType = doc.metadata.type;
    this.stats.documentTypes[docType] = (this.stats.documentTypes[docType] || 0) + 1;
    this.stats.lastUpdated = new Date().toISOString();

    console.log(`✅ Processed document: ${doc.metadata.filename}`);
  }

  async loadSampleData(): Promise<void> {
    console.log('📊 Loading sample PE data...');

    try {
      // Generate sample data files
      await this.generateSampleData();

      // Process each sample file
      const sampleFiles = [
        'data/sample/companies_financials.csv',
        'data/sample/sales_transactions.csv',
        'data/sample/customer_data.csv',
        'data/sample/risk_assessment.txt',
        'data/sample/market_analysis.txt'
      ];

      const processPromises = sampleFiles.map(async (filepath) => {
        try {
          const content = await fs.readFile(filepath, 'utf-8');
          const filename = path.basename(filepath);

          const doc: ParsedDocument = {
            id: `sample_${filename.replace(/\./g, '_')}_${Date.now()}`,
            content: content,
            metadata: {
              filename: filename,
              type: this.getFileType(filename),
              size: content.length,
              parsedAt: new Date().toISOString(),
              source: 'sample_data'
            },
            chunks: await this.createChunks(content, filename)
          };

          await this.processDocument(doc);
        } catch (error) {
          console.error(`Error loading sample file ${filepath}:`, error);
        }
      });

      await Promise.all(processPromises);

      console.log('✅ Sample data loaded successfully');
    } catch (error) {
      console.error('Failed to load sample data:', error);
      throw error;
    }
  }

  private async generateSampleData(): Promise<void> {
    // Generate companies data
    const companiesData = this.generateCompaniesCSV(500);
    await fs.writeFile('data/sample/companies_financials.csv', companiesData);

    // Generate transactions data
    const transactionsData = this.generateTransactionsCSV(10000);
    await fs.writeFile('data/sample/sales_transactions.csv', transactionsData);

    // Generate customer data
    const customerData = this.generateCustomerCSV(1000);
    await fs.writeFile('data/sample/customer_data.csv', customerData);

    // Generate risk assessment document
    const riskDoc = this.generateRiskAssessment();
    await fs.writeFile('data/sample/risk_assessment.txt', riskDoc);

    // Generate market analysis
    const marketDoc = this.generateMarketAnalysis();
    await fs.writeFile('data/sample/market_analysis.txt', marketDoc);

    console.log('✅ Sample data files generated');
  }

  private generateCompaniesCSV(count: number): string {
    const headers = ['company_id', 'name', 'sector', 'revenue_millions', 'ebitda_millions',
                     'ebitda_margin', 'debt_millions', 'equity_millions', 'employees', 'year_founded'];
    const sectors = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
                     'Energy', 'Real Estate', 'Consumer Goods'];

    const rows = [headers.join(',')];

    for (let i = 1; i <= count; i++) {
      const revenue = Math.floor(Math.random() * 1000) + 50;
      const ebitda = Math.floor(revenue * (Math.random() * 0.3 + 0.1));
      const margin = (ebitda / revenue * 100).toFixed(1);
      const debt = Math.floor(Math.random() * 500);
      const equity = Math.floor(Math.random() * 800) + 100;
      const employees = Math.floor(Math.random() * 5000) + 50;
      const yearFounded = Math.floor(Math.random() * 50) + 1970;

      rows.push([
        `COMP${i.toString().padStart(4, '0')}`,
        `"Company ${i}"`,
        sectors[Math.floor(Math.random() * sectors.length)],
        revenue,
        ebitda,
        margin,
        debt,
        equity,
        employees,
        yearFounded
      ].join(','));
    }

    return rows.join('\n');
  }

  private generateTransactionsCSV(count: number): string {
    const headers = ['transaction_id', 'date', 'company_id', 'customer_id', 'product',
                     'quantity', 'unit_price', 'total_amount', 'payment_status'];
    const products = ['Software License', 'Consulting', 'Hardware', 'Support', 'Training', 'Cloud Service'];
    const statuses = ['Paid', 'Pending', 'Overdue', 'Cancelled'];

    const rows = [headers.join(',')];

    for (let i = 1; i <= count; i++) {
      const date = new Date(2023, 0, 1 + Math.floor(Math.random() * 365));
      const companyId = `COMP${Math.floor(Math.random() * 500 + 1).toString().padStart(4, '0')}`;
      const customerId = `CUST${Math.floor(Math.random() * 1000 + 1).toString().padStart(4, '0')}`;
      const quantity = Math.floor(Math.random() * 100) + 1;
      const unitPrice = Math.floor(Math.random() * 10000) + 100;
      const total = quantity * unitPrice;

      rows.push([
        `TRX${i.toString().padStart(6, '0')}`,
        date.toISOString().split('T')[0],
        companyId,
        customerId,
        products[Math.floor(Math.random() * products.length)],
        quantity,
        unitPrice,
        total,
        statuses[Math.floor(Math.random() * statuses.length)]
      ].join(','));
    }

    return rows.join('\n');
  }

  private generateCustomerCSV(count: number): string {
    const headers = ['customer_id', 'name', 'industry', 'annual_revenue', 'employee_count',
                     'country', 'credit_rating', 'account_status'];
    const industries = ['Banking', 'Insurance', 'Retail', 'Technology', 'Healthcare', 'Government'];
    const countries = ['USA', 'UK', 'Germany', 'France', 'Japan', 'Canada', 'Australia'];
    const ratings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B'];
    const statuses = ['Active', 'Inactive', 'Suspended'];

    const rows = [headers.join(',')];

    for (let i = 1; i <= count; i++) {
      rows.push([
        `CUST${i.toString().padStart(4, '0')}`,
        `"Customer ${i}"`,
        industries[Math.floor(Math.random() * industries.length)],
        Math.floor(Math.random() * 10000) + 100,
        Math.floor(Math.random() * 50000) + 100,
        countries[Math.floor(Math.random() * countries.length)],
        ratings[Math.floor(Math.random() * ratings.length)],
        statuses[Math.floor(Math.random() * statuses.length)]
      ].join(','));
    }

    return rows.join('\n');
  }

  private generateRiskAssessment(): string {
    return `PRIVATE EQUITY PORTFOLIO RISK ASSESSMENT REPORT
Generated: ${new Date().toISOString()}
Analysis powered by GPT-5

EXECUTIVE SUMMARY
=================
This comprehensive risk assessment evaluates key risk factors across our private equity portfolio,
identifying critical areas requiring immediate attention and strategic mitigation.

KEY RISK FACTORS
================

1. MARKET RISK
   - Economic downturn vulnerability: HIGH
   - Sector concentration in technology (45% of portfolio)
   - Geographic exposure primarily in North America (78%)
   - Currency risk from international operations

2. OPERATIONAL RISK
   - Supply chain disruptions affecting 3 portfolio companies
   - Talent retention challenges in competitive markets
   - Technology infrastructure requires modernization
   - Cybersecurity threats increasing across all sectors

3. FINANCIAL RISK
   - Leverage ratios exceeding 6x EBITDA in 5 companies
   - Working capital constraints in retail portfolio
   - Interest rate sensitivity with floating rate debt
   - Covenant compliance concerns for 2 investments

4. REGULATORY RISK
   - Data privacy regulations (GDPR, CCPA) compliance
   - Environmental regulations affecting manufacturing
   - Healthcare regulatory changes impacting 3 companies
   - Tax law changes potentially affecting returns

5. STRATEGIC RISK
   - Market share erosion in mature sectors
   - Disruptive technology threats to traditional businesses
   - Customer concentration >30% in 8 companies
   - Competitive pressure from new entrants

RISK MITIGATION STRATEGIES
==========================

Immediate Actions:
- Restructure debt for highly leveraged companies
- Diversify customer base in concentrated companies
- Implement comprehensive cybersecurity programs
- Enhance supply chain resilience

Medium-term Initiatives:
- Geographic and sector diversification
- Digital transformation investments
- Talent development and retention programs
- ESG compliance and reporting improvements

PORTFOLIO COMPANY SPECIFIC RISKS
================================

High Risk Companies (Immediate Attention):
- COMP0045: Customer concentration 67%, urgent diversification needed
- COMP0112: Debt/EBITDA ratio 8.2x, restructuring required
- COMP0234: Regulatory compliance issues, legal review underway

Medium Risk Companies (Monitor Closely):
- 15 companies with moderate operational challenges
- 8 companies facing competitive pressures
- 12 companies with technology modernization needs

CONCLUSIONS
===========
The portfolio shows resilience but requires active risk management. Focus areas include
debt restructuring, customer diversification, and technology investments. Continuous
monitoring and proactive intervention will be critical for value preservation and creation.`;
  }

  private generateMarketAnalysis(): string {
    return `PRIVATE EQUITY MARKET ANALYSIS
Q4 2025 Update - Powered by GPT-5 Advanced Analytics

MARKET OVERVIEW
===============
The private equity market continues to evolve with significant shifts in valuation multiples,
deal activity, and exit strategies. This analysis provides comprehensive insights into current
market dynamics and emerging opportunities.

DEAL ACTIVITY TRENDS
====================

Volume Metrics:
- Total deals YTD: 4,567 (down 12% YoY)
- Average deal size: $485M (up 8% YoY)
- Mega-deals (>$1B): 145 transactions
- Mid-market most active segment

Sector Performance:
1. Technology: 35% of deal volume, 11.2x EBITDA average
2. Healthcare: 22% of volume, 10.8x EBITDA average
3. Consumer: 15% of volume, 9.5x EBITDA average
4. Industrial: 12% of volume, 8.7x EBITDA average
5. Financial Services: 10% of volume, 10.1x EBITDA average

VALUATION DYNAMICS
==================

Current Multiples:
- Overall average: 10.5x EBITDA (down from 11.8x peak)
- Software/SaaS: 15-20x ARR for high-growth
- Traditional sectors: 7-9x EBITDA
- Add-on acquisitions: 8.5x average

Factors Affecting Valuations:
- Interest rate environment stabilizing
- Quality assets commanding premium prices
- Increased scrutiny on growth projections
- ESG considerations impacting valuations

EXIT ENVIRONMENT
================

Exit Routes:
- Strategic buyers: 45% of exits
- Secondary buyouts: 35% of exits
- IPOs: 8% of exits (improving)
- Continuation funds: 12% of exits

Exit Challenges:
- Valuation gaps between buyers and sellers
- Longer hold periods (average 5.8 years)
- Regulatory scrutiny on large transactions
- Market volatility affecting timing

FUNDRAISING LANDSCAPE
====================

Capital Raising:
- $312B raised YTD globally
- Average fund size: $1.8B
- Oversubscribed funds for top-tier GPs
- First-time funds facing challenges

LP Sentiment:
- Focus on established managers
- Co-investment opportunities in demand
- Increased due diligence requirements
- Portfolio rebalancing ongoing

EMERGING OPPORTUNITIES
======================

Growth Areas:
1. AI and Machine Learning companies
2. Energy transition and sustainability
3. Healthcare technology and services
4. Digital infrastructure
5. Supply chain technology

Investment Themes:
- Operational value creation focus
- Buy-and-build strategies prevalent
- Carve-outs from corporates
- Distressed opportunities emerging
- Cross-border transactions increasing

COMPETITIVE LANDSCAPE
====================

Key Players:
- Large buyout funds competing for assets
- Strategic buyers active in select sectors
- Family offices direct investing
- Sovereign wealth funds increasing allocations

Differentiation Strategies:
- Sector specialization
- Operational expertise
- Proprietary sourcing
- Value creation playbooks
- ESG integration

OUTLOOK AND RECOMMENDATIONS
===========================

Near-term Expectations:
- Continued selectivity in new investments
- Focus on portfolio value creation
- Gradual improvement in exit activity
- Fundraising to remain challenging

Strategic Recommendations:
1. Maintain pricing discipline
2. Accelerate portfolio company improvements
3. Prepare quality assets for exit
4. Build dry powder for opportunities
5. Strengthen LP relationships

CONCLUSION
==========
The PE market is transitioning to a more normalized environment with focus on
fundamentals and operational improvements. Success will require disciplined
investing, active portfolio management, and strategic positioning for the next cycle.`;
  }

  private async createChunks(content: string, filename: string): Promise<Array<{
    text: string;
    metadata: Record<string, any>;
  }>> {
    const chunkSize = 1000;
    const overlap = 200;
    const chunks: Array<{ text: string; metadata: Record<string, any> }> = [];

    for (let i = 0; i < content.length; i += (chunkSize - overlap)) {
      const chunk = content.slice(i, i + chunkSize);
      if (chunk.trim().length > 0) {
        chunks.push({
          text: chunk,
          metadata: {
            source: filename,
            chunkIndex: chunks.length,
            startPosition: i
          }
        });
      }
    }

    return chunks;
  }

  private getFileType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const typeMap: Record<string, string> = {
      csv: 'csv',
      txt: 'text',
      pdf: 'pdf',
      xlsx: 'excel',
      docx: 'word'
    };
    return typeMap[ext || ''] || 'unknown';
  }

  async getDataStats(): Promise<DataStats> {
    if (this.vectorSearch) {
      const vectorStats = await this.vectorSearch.getStats();
      this.stats.totalChunks = vectorStats.totalChunks;
      this.stats.totalDocuments = vectorStats.totalDocuments;
    }

    return this.stats;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up data processor...');
    if (this.vectorSearch) {
      await this.vectorSearch.cleanup();
    }
  }
}