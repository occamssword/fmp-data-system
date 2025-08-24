import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPDataLoader } from '../src/fmp-rate-limiter.js';

config();

/**
 * Government Contracts Data Loader
 * Loads federal contracting data, lobbying expenditures, and congressional trading
 */
class GovernmentContractsLoader {
  private loader: FMPDataLoader;
  private db: DatabaseClient;
  private stats = {
    contractsLoaded: 0,
    lobbyingLoaded: 0,
    senateTradesLoaded: 0,
    houseTradesLoaded: 0,
    errors: 0
  };

  constructor() {
    this.db = new DatabaseClient();
    this.loader = new FMPDataLoader(this.db.pool);
  }

  /**
   * Load government contracts data
   */
  async loadGovernmentContracts(): Promise<void> {
    console.log('\n[Contracts] Loading government contracts...');
    
    try {
      // Get top companies by market cap
      const companies = await this.db.query(`
        SELECT symbol, name FROM fmp.companies 
        WHERE market_cap > 10000000000 
        ORDER BY market_cap DESC 
        LIMIT 100
      `);

      for (const company of companies.rows) {
        try {
          const data = await this.loader.rateLimiter.makeRequest(
            `/government-contracts/${company.symbol}`
          );

          if (data && Array.isArray(data)) {
            for (const contract of data) {
              await this.db.query(`
                INSERT INTO fmp.government_contracts (
                  company_name, ticker, award_date, agency,
                  contract_value, contract_id, description,
                  contract_type, completion_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
              `, [
                contract.companyName || company.name,
                company.symbol,
                contract.awardDate ? new Date(contract.awardDate) : null,
                contract.agency,
                contract.contractValue,
                contract.contractId,
                contract.description,
                contract.contractType,
                contract.completionDate ? new Date(contract.completionDate) : null
              ]);
              
              this.stats.contractsLoaded++;
            }
          }
          
          await this.sleep(100);
        } catch (error: any) {
          // Continue on error - endpoint may not have data for all companies
          if (!error.message.includes('404')) {
            console.error(`Error loading contracts for ${company.symbol}:`, error.message);
            this.stats.errors++;
          }
        }
      }
      
      console.log(`✓ Loaded ${this.stats.contractsLoaded} government contracts`);
    } catch (error: any) {
      console.error('Error loading government contracts:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load lobbying data
   */
  async loadLobbyingData(): Promise<void> {
    console.log('\n[Lobbying] Loading lobbying expenditures...');
    
    try {
      // Get companies known to have lobbying activity
      const lobbyingCompanies = [
        'AAPL', 'GOOGL', 'AMZN', 'META', 'MSFT', 'BA', 'LMT', 'NOC', 'RTX', 'GD',
        'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'PFE', 'JNJ', 'MRK', 'ABBV',
        'CVS', 'UNH', 'ANTM', 'CNC', 'XOM', 'CVX', 'COP', 'SLB', 'T', 'VZ'
      ];

      for (const symbol of lobbyingCompanies) {
        try {
          const data = await this.loader.rateLimiter.makeRequest(
            `/lobbying/${symbol}`
          );

          if (data && Array.isArray(data)) {
            for (const lobby of data) {
              await this.db.query(`
                INSERT INTO fmp.lobbying_data (
                  company_name, ticker, year, quarter,
                  amount, issues, lobbyists, bills,
                  specific_issues
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
              `, [
                lobby.companyName,
                symbol,
                lobby.year,
                lobby.quarter,
                lobby.amount,
                lobby.issues,
                lobby.lobbyists,
                lobby.bills,
                lobby.specificIssues
              ]);
              
              this.stats.lobbyingLoaded++;
            }
          }
          
          await this.sleep(100);
        } catch (error: any) {
          // Continue on error - not all companies have lobbying data
          if (!error.message.includes('404')) {
            console.error(`Error loading lobbying for ${symbol}:`, error.message);
            this.stats.errors++;
          }
        }
      }
      
      console.log(`✓ Loaded ${this.stats.lobbyingLoaded} lobbying records`);
    } catch (error: any) {
      console.error('Error loading lobbying data:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load senate trading data
   */
  async loadSenateTrading(): Promise<void> {
    console.log('\n[Senate] Loading senate trading activity...');
    
    try {
      const data = await this.loader.rateLimiter.makeRequest('/senate-trading', {
        limit: 500
      });

      if (!data || !Array.isArray(data)) {
        console.log('No senate trading data available');
        return;
      }

      for (const trade of data) {
        try {
          await this.db.query(`
            INSERT INTO fmp.senate_trading (
              senator_name, state, party, symbol,
              transaction_date, disclosure_date,
              transaction_type, amount_range,
              asset_type, asset_description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING
          `, [
            trade.senatorName,
            trade.state,
            trade.party,
            trade.symbol,
            trade.transactionDate ? new Date(trade.transactionDate) : null,
            trade.disclosureDate ? new Date(trade.disclosureDate) : null,
            trade.transactionType,
            trade.amountRange,
            trade.assetType,
            trade.assetDescription
          ]);
          
          this.stats.senateTradesLoaded++;
        } catch (error: any) {
          console.error(`Error loading senate trade:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.senateTradesLoaded} senate trades`);
    } catch (error: any) {
      console.error('Error loading senate trading:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load house trading data
   */
  async loadHouseTrading(): Promise<void> {
    console.log('\n[House] Loading house trading activity...');
    
    try {
      const data = await this.loader.rateLimiter.makeRequest('/house-trading', {
        limit: 500
      });

      if (!data || !Array.isArray(data)) {
        console.log('No house trading data available');
        return;
      }

      for (const trade of data) {
        try {
          await this.db.query(`
            INSERT INTO fmp.house_trading (
              representative_name, state, district, party,
              symbol, transaction_date, disclosure_date,
              transaction_type, amount_range, asset_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING
          `, [
            trade.representativeName,
            trade.state,
            trade.district,
            trade.party,
            trade.symbol,
            trade.transactionDate ? new Date(trade.transactionDate) : null,
            trade.disclosureDate ? new Date(trade.disclosureDate) : null,
            trade.transactionType,
            trade.amountRange,
            trade.assetType
          ]);
          
          this.stats.houseTradesLoaded++;
        } catch (error: any) {
          console.error(`Error loading house trade:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.houseTradesLoaded} house trades`);
    } catch (error: any) {
      console.error('Error loading house trading:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Analyze congressional trading patterns
   */
  async analyzeCongressionalTrading(): Promise<void> {
    console.log('\n[Analysis] Analyzing congressional trading patterns...');
    
    try {
      // Most traded stocks by Congress
      const topStocks = await this.db.query(`
        SELECT symbol, COUNT(*) as trade_count,
               SUM(CASE WHEN transaction_type LIKE '%Buy%' THEN 1 ELSE 0 END) as buys,
               SUM(CASE WHEN transaction_type LIKE '%Sell%' THEN 1 ELSE 0 END) as sells
        FROM (
          SELECT symbol, transaction_type FROM fmp.senate_trading
          UNION ALL
          SELECT symbol, transaction_type FROM fmp.house_trading
        ) combined
        WHERE symbol IS NOT NULL
        GROUP BY symbol
        ORDER BY trade_count DESC
        LIMIT 10
      `);

      if (topStocks.rows.length > 0) {
        console.log('\nTop 10 Stocks Traded by Congress:');
        console.log('Symbol | Trades | Buys | Sells');
        console.log('-'.repeat(35));
        for (const stock of topStocks.rows) {
          console.log(`${stock.symbol.padEnd(6)} | ${stock.trade_count.toString().padEnd(6)} | ${stock.buys.toString().padEnd(4)} | ${stock.sells}`);
        }
      }

      // Recent unusual activity
      const recentActivity = await this.db.query(`
        SELECT senator_name as name, symbol, transaction_type, amount_range, 
               transaction_date, 'Senate' as chamber
        FROM fmp.senate_trading
        WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
          AND amount_range LIKE '%1,000,001%'
        UNION ALL
        SELECT representative_name as name, symbol, transaction_type, amount_range,
               transaction_date, 'House' as chamber
        FROM fmp.house_trading
        WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
          AND amount_range LIKE '%1,000,001%'
        ORDER BY transaction_date DESC
        LIMIT 5
      `);

      if (recentActivity.rows.length > 0) {
        console.log('\nRecent Large Congressional Trades (>$1M):');
        for (const trade of recentActivity.rows) {
          console.log(`${trade.chamber}: ${trade.name} - ${trade.transaction_type} ${trade.symbol} (${trade.amount_range})`);
        }
      }
    } catch (error: any) {
      console.error('Error analyzing congressional trading:', error.message);
    }
  }

  /**
   * Print summary statistics
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('GOVERNMENT DATA LOADER SUMMARY');
    console.log('='.repeat(60));
    console.log(`Government Contracts Loaded: ${this.stats.contractsLoaded}`);
    console.log(`Lobbying Records Loaded: ${this.stats.lobbyingLoaded}`);
    console.log(`Senate Trades Loaded: ${this.stats.senateTradesLoaded}`);
    console.log(`House Trades Loaded: ${this.stats.houseTradesLoaded}`);
    console.log(`Total Records: ${this.stats.contractsLoaded + this.stats.lobbyingLoaded + this.stats.senateTradesLoaded + this.stats.houseTradesLoaded}`);
    console.log(`Errors Encountered: ${this.stats.errors}`);
    console.log('='.repeat(60));
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main execution
   */
  async run(): Promise<void> {
    try {
      await this.db.connect();
      console.log('✓ Database connected');
      
      console.log('\n' + '='.repeat(60));
      console.log('LOADING GOVERNMENT & CONGRESSIONAL DATA');
      console.log('='.repeat(60));
      
      // Load all government data
      await this.loadSenateTrading();
      await this.loadHouseTrading();
      await this.loadLobbyingData();
      await this.loadGovernmentContracts();
      
      // Analyze patterns
      await this.analyzeCongressionalTrading();
      
      this.printSummary();
      
    } catch (error: any) {
      console.error('Fatal error:', error.message);
      console.error(error);
    } finally {
      await this.db.disconnect();
      process.exit(0);
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const loader = new GovernmentContractsLoader();
  loader.run().catch(console.error);
}

export { GovernmentContractsLoader };