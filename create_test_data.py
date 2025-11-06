"""
Generate comprehensive test data for PE Data Analysis POC
Creates realistic financial data, transactions, and documents
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

def create_test_data(folder="kaggle_data"):
    """Generate test data for POC demonstration"""

    print(f"📊 Creating test data in '{folder}' directory...")
    os.makedirs(folder, exist_ok=True)

    # Set random seed for reproducibility
    np.random.seed(42)

    # 1. Create S&P 500 style financial data
    print("Creating financial data...")
    companies = []
    for i in range(500):
        company = {
            'Company': f'Company_{i:03d}',
            'Ticker': f'{chr(65+i%26)}{chr(65+(i//26)%26)}{chr(65+(i//676)%26)}',
            'Sector': np.random.choice(['Technology', 'Healthcare', 'Finance', 'Retail', 'Energy', 'Manufacturing', 'Real Estate', 'Consumer Goods']),
            'Industry': np.random.choice(['Software', 'Hardware', 'Biotech', 'Banking', 'Insurance', 'E-commerce', 'Oil & Gas', 'Renewable Energy']),
            'Market_Cap': np.random.uniform(1000, 100000),  # in millions
            'Revenue_2023': np.random.uniform(100, 10000),
            'Revenue_2022': np.random.uniform(100, 9000),
            'Revenue_2021': np.random.uniform(100, 8000),
            'EBITDA_2023': np.random.uniform(10, 2000),
            'EBITDA_2022': np.random.uniform(10, 1800),
            'EBITDA_2021': np.random.uniform(10, 1600),
            'NetIncome_2023': np.random.uniform(-100, 1000),
            'NetIncome_2022': np.random.uniform(-100, 900),
            'NetIncome_2021': np.random.uniform(-100, 800),
            'TotalAssets': np.random.uniform(1000, 50000),
            'TotalDebt': np.random.uniform(100, 20000),
            'TotalEquity': np.random.uniform(500, 30000),
            'Cash': np.random.uniform(50, 5000),
            'Employees': np.random.randint(50, 50000),
            'Founded': np.random.randint(1950, 2020),
            'Headquarters': np.random.choice(['New York', 'San Francisco', 'Boston', 'Chicago', 'Austin', 'Seattle', 'Los Angeles', 'Miami'])
        }

        # Calculate derived metrics
        company['EBITDA_Margin_2023'] = (company['EBITDA_2023'] / company['Revenue_2023']) * 100
        company['Net_Margin_2023'] = (company['NetIncome_2023'] / company['Revenue_2023']) * 100
        company['Revenue_Growth_YoY'] = ((company['Revenue_2023'] - company['Revenue_2022']) / company['Revenue_2022']) * 100
        company['Debt_to_Equity'] = company['TotalDebt'] / company['TotalEquity']
        company['ROE'] = (company['NetIncome_2023'] / company['TotalEquity']) * 100
        company['ROA'] = (company['NetIncome_2023'] / company['TotalAssets']) * 100
        company['Current_Ratio'] = np.random.uniform(0.5, 3.0)
        company['PE_Ratio'] = np.random.uniform(5, 50) if company['NetIncome_2023'] > 0 else None

        companies.append(company)

    financial_df = pd.DataFrame(companies)
    financial_df.to_csv(f"{folder}/sp500_financials.csv", index=False)
    print(f"✅ Created sp500_financials.csv ({len(financial_df)} companies)")

    # 2. Create detailed sales transaction data
    print("Creating sales transaction data...")
    transactions = []
    start_date = datetime(2023, 1, 1)

    for i in range(10000):
        transaction = {
            'TransactionID': f'TXN{i:08d}',
            'Date': start_date + timedelta(hours=i),
            'Customer': f'CUST{np.random.randint(1, 1001):04d}',
            'Product': np.random.choice(['Product_A', 'Product_B', 'Product_C', 'Product_D', 'Product_E', 'Service_X', 'Service_Y', 'Service_Z']),
            'Category': np.random.choice(['Hardware', 'Software', 'Services', 'Subscription', 'Consulting']),
            'Quantity': np.random.randint(1, 100),
            'UnitPrice': np.random.uniform(10, 5000),
            'Discount': np.random.choice([0, 0.05, 0.1, 0.15, 0.2], p=[0.5, 0.2, 0.15, 0.1, 0.05]),
            'Region': np.random.choice(['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa']),
            'Country': np.random.choice(['USA', 'UK', 'Germany', 'Japan', 'China', 'Brazil', 'India', 'Australia']),
            'Sales_Channel': np.random.choice(['Direct', 'Partner', 'Online', 'Retail']),
            'Payment_Method': np.random.choice(['Credit Card', 'Wire Transfer', 'ACH', 'Check', 'Cash']),
            'Sales_Rep': f'REP{np.random.randint(1, 51):03d}',
            'Status': np.random.choice(['Completed', 'Pending', 'Cancelled'], p=[0.85, 0.1, 0.05])
        }

        # Calculate totals
        transaction['Gross_Revenue'] = transaction['Quantity'] * transaction['UnitPrice']
        transaction['Discount_Amount'] = transaction['Gross_Revenue'] * transaction['Discount']
        transaction['Net_Revenue'] = transaction['Gross_Revenue'] - transaction['Discount_Amount']
        transaction['Tax'] = transaction['Net_Revenue'] * 0.08  # 8% tax rate
        transaction['Total'] = transaction['Net_Revenue'] + transaction['Tax']

        transactions.append(transaction)

    sales_df = pd.DataFrame(transactions)
    sales_df.to_excel(f"{folder}/sales_transactions.xlsx", index=False)
    print(f"✅ Created sales_transactions.xlsx ({len(sales_df)} transactions)")

    # 3. Create customer data
    print("Creating customer data...")
    customers = []
    for i in range(1000):
        customer = {
            'CustomerID': f'CUST{i:04d}',
            'CompanyName': f'Client_Corp_{i:04d}',
            'Industry': np.random.choice(['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Government']),
            'Size': np.random.choice(['Small', 'Medium', 'Large', 'Enterprise']),
            'AnnualRevenue': np.random.uniform(1, 10000),  # in millions
            'EmployeeCount': np.random.randint(10, 100000),
            'Founded': np.random.randint(1970, 2020),
            'ContractValue': np.random.uniform(10, 5000),  # in thousands
            'ContractLength': np.random.choice([6, 12, 24, 36]),  # months
            'ContractStartDate': f"2023-{np.random.randint(1, 13):02d}-{np.random.randint(1, 29):02d}",
            'AccountManager': f'AM{np.random.randint(1, 21):03d}',
            'SatisfactionScore': np.random.uniform(3.0, 5.0),
            'NPS_Score': np.random.randint(-100, 101),
            'Support_Tickets': np.random.randint(0, 50),
            'ChurnRisk': np.random.choice(['Low', 'Medium', 'High'], p=[0.7, 0.2, 0.1]),
            'PaymentTerms': np.random.choice(['Net 30', 'Net 45', 'Net 60', 'Immediate']),
            'Location': np.random.choice(['New York', 'San Francisco', 'London', 'Tokyo', 'Singapore', 'Berlin', 'Sydney'])
        }

        # Calculate derived metrics
        customer['Revenue_per_Employee'] = customer['AnnualRevenue'] * 1000000 / customer['EmployeeCount']
        customer['Contract_Monthly_Value'] = customer['ContractValue'] / customer['ContractLength']

        customers.append(customer)

    customer_df = pd.DataFrame(customers)
    customer_df.to_csv(f"{folder}/customer_data.csv", index=False)
    print(f"✅ Created customer_data.csv ({len(customer_df)} customers)")

    # 4. Create sample text documents
    print("Creating document files...")

    # Risk Assessment Report
    risk_report = """COMPREHENSIVE RISK ASSESSMENT REPORT 2023
====================================================

EXECUTIVE SUMMARY
-----------------
This comprehensive risk assessment identifies critical factors that could impact our organization's strategic objectives and operational performance.

1. CUSTOMER CONCENTRATION RISK
-------------------------------
Current State:
- Top 3 customers represent 45% of total revenue ($225M of $500M)
- Largest single customer accounts for 22% of revenue
- Customer #1: TechCorp Inc. - $110M (22%)
- Customer #2: Global Systems Ltd - $75M (15%)
- Customer #3: Enterprise Solutions - $40M (8%)

Trend Analysis:
- Customer retention rate: 87% (down from 92% in 2022)
- Average contract length decreasing: 24 months to 18 months
- Pricing pressure from top accounts: -5% on renewals

Risk Level: HIGH
Impact: Severe revenue volatility if major customer lost
Probability: Medium (30-40% chance within 24 months)

Mitigation Strategy:
- Diversify customer base: target 50 new mid-market clients
- Enhance customer success program
- Implement tiered pricing strategy
- Develop new product offerings to increase stickiness

2. MARKET COMPETITION
---------------------
Competitive Landscape:
- Three new entrants in primary market segment
- Price compression: average -3% across product lines
- Market share: declined from 15% to 13.5%
- Technology disruption from AI-powered alternatives

Key Competitors:
- Competitor A: 25% market share, aggressive pricing
- Competitor B: 20% market share, superior technology
- Competitor C: 18% market share, strong brand
- New Entrant D: 5% market share, venture-backed

Risk Level: MEDIUM-HIGH
Impact: Margin compression and market share loss
Probability: High (60-70% continued pressure)

3. REGULATORY COMPLIANCE
------------------------
Regulatory Changes:
- New data privacy regulations (GDPR-style) Q3 2024
- Industry-specific compliance requirements
- Environmental regulations affecting operations
- Tax law changes in key jurisdictions

Compliance Gaps:
- Data governance framework incomplete
- Third-party vendor compliance not verified
- Documentation standards below requirements

Financial Impact:
- Estimated compliance costs: $2.5M annually
- Potential fines: up to $10M for violations
- Implementation timeline: 18 months

Risk Level: MEDIUM
Impact: Significant financial and reputational damage
Probability: Medium (regulatory changes confirmed)

4. OPERATIONAL RISKS
--------------------
Supply Chain:
- 30% of products affected by supply disruptions
- Single supplier for 3 critical components
- Lead times increased 40% YoY
- Cost inflation: +12% on raw materials

Technology Infrastructure:
- Legacy systems at 85% of capacity
- Cybersecurity incidents: 15 attempts, 2 breaches
- System downtime: 42 hours YTD (target: 20 hours)
- Technical debt: $5M investment required

Human Capital:
- Key person dependencies in 5 critical roles
- Turnover rate: 18% (industry average: 15%)
- Skills gap in emerging technologies
- Succession planning incomplete

Risk Level: HIGH
Impact: Business continuity and efficiency
Probability: High (issues already manifesting)

5. FINANCIAL RISKS
------------------
Capital Structure:
- Debt-to-equity ratio: 1.8x (covenant limit: 2.0x)
- Interest coverage: 3.2x (declining from 4.5x)
- Working capital days: 85 (up from 68)

Liquidity:
- Cash position: $45M (2 months operating expenses)
- Credit facility utilization: 75% of $100M
- DSO: 62 days (target: 45 days)

Market Risks:
- Foreign exchange exposure: 40% of revenue
- Interest rate sensitivity: $2M per 1% increase
- Commodity price exposure: 15% of COGS

Risk Level: MEDIUM
Impact: Financial flexibility and covenant compliance
Probability: Medium (dependent on market conditions)

RECOMMENDATIONS
---------------
Immediate Actions (0-3 months):
1. Launch customer diversification initiative
2. Implement cybersecurity improvements
3. Establish regulatory compliance task force
4. Negotiate backup supplier agreements

Short-term (3-12 months):
1. Reduce debt by $50M through asset sales
2. Upgrade IT infrastructure
3. Implement FX hedging program
4. Develop retention program for key employees

Long-term (12+ months):
1. Strategic acquisition to gain market share
2. Geographic expansion to new markets
3. Product innovation investment
4. Digital transformation initiative

CONCLUSION
----------
While the company maintains a strong market position and solid fundamentals, immediate action is required to address customer concentration and operational risks. The Board should prioritize risk mitigation investments and consider strategic alternatives to ensure long-term sustainability and growth.

Report Prepared By: Risk Management Committee
Date: December 1, 2023
Next Review: March 1, 2024"""

    with open(f"{folder}/risk_assessment_report.txt", 'w') as f:
        f.write(risk_report)
    print("✅ Created risk_assessment_report.txt")

    # Due Diligence Summary
    dd_summary = """DUE DILIGENCE SUMMARY REPORT
Target Company: DataTech Solutions Inc.
Date: November 2023
Prepared for: Private Equity Partners LLC

INVESTMENT HIGHLIGHTS
- Strong revenue growth: 35% CAGR over 3 years
- Recurring revenue model: 85% subscription-based
- High gross margins: 75%+
- Blue-chip customer base
- Experienced management team

KEY FINDINGS

Financial Performance:
- 2023 Revenue: $127M (projected)
- 2023 EBITDA: $31M (24% margin)
- Cash flow positive since 2021
- Clean balance sheet with minimal debt

Market Position:
- #3 player in $2B addressable market
- 15% market share in core segment
- Strong brand recognition
- High customer satisfaction (NPS: 67)

Growth Opportunities:
- Geographic expansion (currently 70% US)
- Product line extensions
- M&A roll-up opportunity
- Upsell to existing base

Key Risks Identified:
- Customer concentration (top 10 = 40% revenue)
- Technology platform needs modernization
- Competitive pressure from larger players
- Key person risk (founder/CEO)

Valuation Considerations:
- Asking price: $425M (13.7x EBITDA)
- Comparable transactions: 12-15x EBITDA
- Strategic value to buyers
- Synergy potential: $8-12M annually

RECOMMENDATION: PROCEED TO FINAL DILIGENCE"""

    with open(f"{folder}/due_diligence_summary.txt", 'w') as f:
        f.write(dd_summary)
    print("✅ Created due_diligence_summary.txt")

    # Financial Analysis
    financial_analysis = """FINANCIAL ANALYSIS MEMORANDUM
Q3 2023 Performance Review

Revenue Analysis:
Total Revenue: $127.5M
- Product Revenue: $89.3M (70%)
- Services Revenue: $38.2M (30%)
YoY Growth: 28%
QoQ Growth: 7%

By Geography:
- North America: $89.3M (70%)
- Europe: $25.5M (20%)
- Asia Pacific: $12.7M (10%)

By Customer Segment:
- Enterprise: $76.5M (60%)
- Mid-Market: $38.3M (30%)
- SMB: $12.7M (10%)

Profitability Analysis:
Gross Profit: $95.6M (75% margin)
Operating Income: $25.5M (20% margin)
EBITDA: $31.9M (25% margin)
Net Income: $19.1M (15% margin)

Cash Flow:
Operating Cash Flow: $28.7M
Free Cash Flow: $22.3M
Cash Conversion: 90%

Balance Sheet Metrics:
Total Assets: $287M
Total Liabilities: $98M
Shareholders' Equity: $189M
Working Capital: $67M

Key Ratios:
Current Ratio: 2.3
Quick Ratio: 2.1
Debt/Equity: 0.52
ROE: 15.2%
ROA: 8.9%

Outlook:
Q4 2023 Guidance: $135-140M revenue
FY 2024 Projection: $165M revenue
Long-term target: $250M by 2026"""

    with open(f"{folder}/financial_analysis.txt", 'w') as f:
        f.write(financial_analysis)
    print("✅ Created financial_analysis.txt")

    # Print summary
    print("\n" + "="*50)
    print("📊 TEST DATA GENERATION COMPLETE!")
    print("="*50)
    print(f"Location: {os.path.abspath(folder)}/")
    print("\nFiles created:")
    print("  ├── sp500_financials.csv (500 companies)")
    print("  ├── sales_transactions.xlsx (10,000 transactions)")
    print("  ├── customer_data.csv (1,000 customers)")
    print("  ├── risk_assessment_report.txt")
    print("  ├── due_diligence_summary.txt")
    print("  └── financial_analysis.txt")
    print(f"\nTotal data points: {500 + 10000 + 1000:,}")
    print("Total size: ~5 MB")
    print("\n✅ Ready for POC demonstration!")

    return folder

if __name__ == "__main__":
    folder = create_test_data()
    print(f"\n💡 Next step: Run 'streamlit run app.py' to start the POC")