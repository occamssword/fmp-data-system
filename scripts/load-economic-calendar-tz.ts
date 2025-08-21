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

// Market hours in Pacific Time
const MARKET_HOURS = {
  preMarket: { start: 1, end: 6 },    // 1:00 AM - 6:30 AM PT
  regular: { start: 6.5, end: 13 },    // 6:30 AM - 1:00 PM PT
  afterMarket: { start: 13, end: 17 }, // 1:00 PM - 5:00 PM PT
};

// Helper function to format date
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper function to determine market session
function getMarketSession(hour: number): string {
  if (hour >= MARKET_HOURS.preMarket.start && hour < MARKET_HOURS.regular.start) {
    return 'Pre-Market';
  } else if (hour >= MARKET_HOURS.regular.start && hour < MARKET_HOURS.regular.end) {
    return 'Market Hours';
  } else if (hour >= MARKET_HOURS.afterMarket.start && hour < MARKET_HOURS.afterMarket.end) {
    return 'After-Market';
  } else {
    return 'Closed';
  }
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

// Load economic calendar data with proper timezone handling
async function loadEconomicCalendar(from: string, to: string) {
  try {
    const data = await fetchEconomicCalendar(from, to);
    
    if (!data || data.length === 0) {
      console.log('No economic calendar data found for the specified period');
      return;
    }
    
    console.log(`Found ${data.length} economic events`);
    console.log('Processing with timezone conversions...\n');
    
    // Updated insert query with timezone columns
    const insertQuery = `
      INSERT INTO fmp.economic_calendar (
        event, date, country, actual, previous, 
        change, change_percentage, estimate, impact,
        date_utc, date_pacific, date_eastern, timezone_original
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT ON CONSTRAINT economic_calendar_unique_event 
      DO UPDATE SET
        actual = EXCLUDED.actual,
        previous = EXCLUDED.previous,
        change = EXCLUDED.change,
        change_percentage = EXCLUDED.change_percentage,
        estimate = EXCLUDED.estimate,
        impact = EXCLUDED.impact,
        date = EXCLUDED.date,
        date_utc = EXCLUDED.date_utc,
        date_pacific = EXCLUDED.date_pacific,
        date_eastern = EXCLUDED.date_eastern,
        timezone_original = EXCLUDED.timezone_original
    `;
    
    let successCount = 0;
    let errorCount = 0;
    const highImpactEvents = [];
    
    for (const event of data) {
      try {
        // Parse the date - FMP provides UTC timestamps
        let eventDateTimeUTC = null;
        if (event.date) {
          // FMP timestamps are in UTC
          if (event.date.includes(' ')) {
            eventDateTimeUTC = new Date(event.date + ' UTC');
          } else {
            eventDateTimeUTC = new Date(event.date + (event.time ? ' ' + event.time : '') + ' UTC');
          }
        }
        
        // Calculate timezone-aware timestamps
        const dateUTC = eventDateTimeUTC?.toISOString();
        const datePacific = eventDateTimeUTC ? 
          new Date(eventDateTimeUTC.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})) : null;
        const dateEastern = eventDateTimeUTC ? 
          new Date(eventDateTimeUTC.toLocaleString("en-US", {timeZone: "America/New_York"})) : null;
        
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
          eventDateTimeUTC,  // Store original UTC time
          event.country,
          event.actual,
          event.previous || event.consensus,
          change,
          changePercentage,
          event.estimate || event.forecast,
          event.impact || event.importance,
          dateUTC,           // UTC timestamp with timezone
          datePacific,       // Pacific timestamp
          dateEastern,       // Eastern timestamp
          'UTC'              // Original timezone from API
        ]);
        
        successCount++;
        
        // Track high impact events for summary
        if (event.impact === 'High' || event.impact === 'high' || event.impact === '3') {
          const pacificHour = datePacific ? datePacific.getHours() + datePacific.getMinutes() / 60 : 0;
          highImpactEvents.push({
            event: event.event || event.title,
            country: event.country,
            dateUTC: eventDateTimeUTC,
            datePacific: datePacific,
            marketSession: getMarketSession(pacificHour),
            actual: event.actual,
            estimate: event.estimate
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
    
    // Show high-impact events during Pacific market hours
    const marketHoursEvents = highImpactEvents.filter(e => 
      e.marketSession === 'Market Hours' || e.marketSession === 'Pre-Market'
    );
    
    if (marketHoursEvents.length > 0) {
      console.log(`\nHigh-impact events during Pacific trading hours:`);
      marketHoursEvents.slice(0, 10).forEach(e => {
        const pacificTime = e.datePacific ? 
          e.datePacific.toLocaleString('en-US', { 
            timeZone: 'America/Los_Angeles',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Unknown';
        console.log(`  ${pacificTime} PT (${e.marketSession}) - ${e.country}: ${e.event}`);
      });
    }
    
    // Query to show timezone comparison
    const timezoneComparison = await pool.query(`
      SELECT 
        event,
        to_char(date_utc, 'MM/DD HH24:MI') as "UTC Time",
        to_char(date_utc AT TIME ZONE 'America/Los_Angeles', 'MM/DD HH24:MI') as "Pacific Time",
        to_char(date_utc AT TIME ZONE 'America/New_York', 'MM/DD HH24:MI') as "Eastern Time",
        country,
        impact
      FROM fmp.economic_calendar
      WHERE impact IN ('High', 'high', 'HIGH', '3')
        AND date_utc >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY date_utc DESC
      LIMIT 5
    `);
    
    if (timezoneComparison.rows.length > 0) {
      console.log('\nRecent high-impact events (timezone comparison):');
      console.table(timezoneComparison.rows);
    }
    
    // Show upcoming events for Pacific timezone trading
    const upcomingPacific = await pool.query(`
      SELECT * FROM fmp.get_upcoming_events_pacific(168)  -- Next 7 days
      WHERE impact IN ('High', 'high', 'HIGH', '3')
      LIMIT 10
    `);
    
    if (upcomingPacific.rows.length > 0) {
      console.log('\nUpcoming high-impact events (Pacific Time):');
      upcomingPacific.rows.forEach((event: any) => {
        const timeUntil = event.time_until_release;
        console.log(`  ${event.release_time_pacific} PT (${event.market_session}) - ${event.country}: ${event.event}`);
        console.log(`    Time until release: ${timeUntil}`);
      });
    }
    
  } catch (error) {
    console.error('Error loading economic calendar:', error);
    throw error;
  }
}

// Create utility functions for Pacific timezone trading
async function setupTradingUtilities() {
  try {
    console.log('Setting up Pacific timezone trading utilities...\n');
    
    // Create a function to get events during market hours
    await pool.query(`
      CREATE OR REPLACE FUNCTION fmp.get_market_hours_events_pacific(
        target_date DATE DEFAULT CURRENT_DATE
      )
      RETURNS TABLE (
        event TEXT,
        release_time TIME,
        country VARCHAR,
        impact VARCHAR,
        actual NUMERIC,
        estimate NUMERIC,
        market_session TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          ec.event::TEXT,
          (ec.date_utc AT TIME ZONE 'America/Los_Angeles')::TIME as release_time,
          ec.country,
          ec.impact,
          ec.actual,
          ec.estimate,
          CASE 
            WHEN EXTRACT(hour FROM ec.date_utc AT TIME ZONE 'America/Los_Angeles') < 6 THEN 'Pre-Market'
            WHEN EXTRACT(hour FROM ec.date_utc AT TIME ZONE 'America/Los_Angeles') >= 6 
                 AND EXTRACT(hour FROM ec.date_utc AT TIME ZONE 'America/Los_Angeles') < 13 THEN 'Market Hours'
            WHEN EXTRACT(hour FROM ec.date_utc AT TIME ZONE 'America/Los_Angeles') >= 13 
                 AND EXTRACT(hour FROM ec.date_utc AT TIME ZONE 'America/Los_Angeles') < 17 THEN 'After-Market'
            ELSE 'Closed'
          END::TEXT as market_session
        FROM fmp.economic_calendar ec
        WHERE DATE(ec.date_utc AT TIME ZONE 'America/Los_Angeles') = target_date
          AND EXTRACT(hour FROM ec.date_utc AT TIME ZONE 'America/Los_Angeles') >= 6
          AND EXTRACT(hour FROM ec.date_utc AT TIME ZONE 'America/Los_Angeles') < 13
        ORDER BY ec.date_utc;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Trading utilities created successfully');
    
  } catch (error) {
    console.error('Error setting up trading utilities:', error);
  }
}

// Main function
async function main() {
  try {
    // Set up timezone support
    console.log('Economic Calendar Loader - Pacific Timezone Edition');
    console.log('====================================================\n');
    
    // Ensure unique constraint exists
    try {
      await pool.query(`
        ALTER TABLE fmp.economic_calendar 
        ADD CONSTRAINT economic_calendar_unique_event 
        UNIQUE (event, date, country)
      `);
    } catch (error: any) {
      // Constraint might already exist
    }
    
    // Calculate date range for past two months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 2);
    
    const fromDate = formatDate(startDate);
    const toDate = formatDate(endDate);
    
    console.log(`Loading economic calendar data from ${fromDate} to ${toDate}`);
    console.log(`Target timezone: Pacific (America/Los_Angeles)`);
    console.log(`Market hours: 6:30 AM - 1:00 PM PT\n`);
    
    // Load the data
    await loadEconomicCalendar(fromDate, toDate);
    
    // Set up trading utilities
    await setupTradingUtilities();
    
    // Show Pacific timezone summary
    const pacificSummary = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE market_session = 'Pre-Market') as pre_market_events,
        COUNT(*) FILTER (WHERE market_session = 'Market Hours') as market_hours_events,
        COUNT(*) FILTER (WHERE market_session = 'After-Market') as after_market_events,
        COUNT(*) FILTER (WHERE market_session = 'Closed') as closed_events,
        COUNT(*) as total_events
      FROM fmp.economic_calendar_pacific
      WHERE release_time_pacific >= CURRENT_DATE - INTERVAL '2 months'
    `);
    
    console.log('\nPacific Timezone Event Distribution:');
    console.table(pacificSummary.rows[0]);
    
    console.log('\n✅ Economic calendar update completed with Pacific timezone support!');
    console.log('\nUseful queries for Pacific timezone trading:');
    console.log('- View all events: SELECT * FROM fmp.economic_calendar_pacific;');
    console.log('- Get upcoming events: SELECT * FROM fmp.get_upcoming_events_pacific(24);');
    console.log('- Get market hours events: SELECT * FROM fmp.get_market_hours_events_pacific();');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Export for use in other scripts
export { fetchEconomicCalendar, loadEconomicCalendar, getMarketSession };

// Run if called directly
main().catch(console.error);