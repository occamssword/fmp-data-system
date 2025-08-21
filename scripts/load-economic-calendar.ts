import axios from 'axios';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// FMP API configuration
const FMP_API_KEY = process.env.FMP_API_KEY || 'afxb7fQ1Fv0cMF0T06gkBkWpqQQiWLEl';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

// PostgreSQL connection pool for FMPData database
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'FMPData',
  user: 'parthbhatt',
  password: ''
});

// Helper function to format date
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Fetch economic calendar data from FMP
async function fetchEconomicCalendar(from: string, to: string) {
  try {
    const url = `${FMP_BASE_URL}/economic_calendar`;
    console.log(`Fetching economic calendar from ${from} to ${to}...`);
    
    const response = await axios.get(url, {
      params: {
        from,
        to,
        apikey: FMP_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching economic calendar:', error);
    throw error;
  }
}

// Load economic calendar data into database
async function loadEconomicCalendar(from: string, to: string) {
  try {
    const data = await fetchEconomicCalendar(from, to);
    
    if (!data || data.length === 0) {
      console.log('No economic calendar data found for the specified period');
      return;
    }
    
    console.log(`Found ${data.length} economic events`);
    
    // Insert query with ON CONFLICT to handle duplicates
    const insertQuery = `
      INSERT INTO fmp.economic_calendar (
        event, date, country, actual, previous, 
        change, change_percentage, estimate, impact
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT ON CONSTRAINT economic_calendar_unique_event 
      DO UPDATE SET
        actual = EXCLUDED.actual,
        previous = EXCLUDED.previous,
        change = EXCLUDED.change,
        change_percentage = EXCLUDED.change_percentage,
        estimate = EXCLUDED.estimate,
        impact = EXCLUDED.impact,
        date = EXCLUDED.date
    `;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const event of data) {
      try {
        // Parse the date and time from the event
        // FMP usually provides date in format "2024-01-15 08:30:00" or similar
        let eventDateTime = null;
        if (event.date) {
          // Check if time is included
          if (event.date.includes(' ')) {
            eventDateTime = new Date(event.date);
          } else {
            // If only date, add time if provided separately
            eventDateTime = new Date(event.date + (event.time ? ' ' + event.time : ''));
          }
        }
        
        // Calculate change if not provided
        let change = event.change;
        let changePercentage = event.changePercentage;
        
        if (event.actual !== null && event.previous !== null && !change) {
          change = event.actual - event.previous;
          if (event.previous !== 0) {
            changePercentage = (change / event.previous) * 100;
          }
        }
        
        await pool.query(insertQuery, [
          event.event || event.title,
          eventDateTime,
          event.country,
          event.actual,
          event.previous || event.consensus,
          change,
          changePercentage,
          event.estimate || event.forecast,
          event.impact || event.importance
        ]);
        
        successCount++;
        
        // Log sample events to see the data structure
        if (successCount <= 3) {
          console.log(`Sample event ${successCount}:`, {
            event: event.event || event.title,
            date: eventDateTime?.toISOString(),
            country: event.country,
            actual: event.actual,
            estimate: event.estimate || event.forecast
          });
        }
      } catch (error: any) {
        errorCount++;
        if (errorCount <= 3) {
          console.error(`Error inserting event: ${error.message}`);
        }
      }
    }
    
    console.log(`\nSummary:`);
    console.log(`- Successfully loaded: ${successCount} events`);
    console.log(`- Errors: ${errorCount} events`);
    
    // Query to show summary by country
    const summaryResult = await pool.query(`
      SELECT 
        country,
        COUNT(*) as event_count,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM fmp.economic_calendar
      WHERE date >= $1::date
      GROUP BY country
      ORDER BY event_count DESC
      LIMIT 10
    `, [from]);
    
    console.log('\nTop countries by event count:');
    summaryResult.rows.forEach((row: any) => {
      console.log(`  ${row.country}: ${row.event_count} events (${row.earliest_date?.toISOString().split('T')[0]} to ${row.latest_date?.toISOString().split('T')[0]})`);
    });
    
  } catch (error) {
    console.error('Error loading economic calendar:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // First, let's add a unique constraint if it doesn't exist
    console.log('Setting up database constraints...');
    
    // Try to add unique constraint (will fail silently if already exists)
    try {
      await pool.query(`
        ALTER TABLE fmp.economic_calendar 
        ADD CONSTRAINT economic_calendar_unique_event 
        UNIQUE (event, date, country)
      `);
      console.log('Added unique constraint to prevent duplicates');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('Unique constraint already exists');
      } else {
        console.log('Note: Could not add unique constraint, will use simple insert');
      }
    }
    
    // Calculate date range for past two months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 2);
    
    const fromDate = formatDate(startDate);
    const toDate = formatDate(endDate);
    
    console.log(`\nLoading economic calendar data from ${fromDate} to ${toDate}`);
    console.log('API Key:', FMP_API_KEY ? 'Configured' : 'Missing');
    
    // Load the data
    await loadEconomicCalendar(fromDate, toDate);
    
    // Show total count in database
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM fmp.economic_calendar'
    );
    console.log(`\nTotal events in database: ${totalResult.rows[0].total}`);
    
    // Show some recent high-impact events
    const recentHighImpact = await pool.query(`
      SELECT 
        date,
        country,
        event,
        actual,
        estimate,
        previous,
        impact
      FROM fmp.economic_calendar
      WHERE impact IN ('High', 'high', 'HIGH', '3')
        AND date >= $1::date
      ORDER BY date DESC
      LIMIT 5
    `, [fromDate]);
    
    if (recentHighImpact.rows.length > 0) {
      console.log('\nRecent high-impact events:');
      recentHighImpact.rows.forEach((event: any) => {
        const date = event.date ? new Date(event.date).toISOString() : 'Unknown date';
        console.log(`  ${date} - ${event.country}: ${event.event}`);
        console.log(`    Actual: ${event.actual}, Estimate: ${event.estimate}, Previous: ${event.previous}`);
      });
    }
    
    console.log('\n✅ Economic calendar update completed successfully!');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Export for use in other scripts
export { fetchEconomicCalendar, loadEconomicCalendar };

// Run if called directly
main().catch(console.error);