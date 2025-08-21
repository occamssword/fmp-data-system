import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import axios from 'axios';

// Load environment variables
config();

async function testDatabaseConnection() {
    console.log('Testing PostgreSQL connection...');
    const db = new DatabaseClient();
    
    try {
        await db.connect();
        const result = await db.query('SELECT NOW() as current_time');
        console.log('✅ Database connected successfully!');
        console.log('   Current database time:', result.rows[0].current_time);
        
        // Check if fmpdata database exists
        const dbCheck = await db.query(`
            SELECT datname FROM pg_database WHERE datname = 'fmpdata'
        `);
        
        if (dbCheck.rows.length > 0) {
            console.log('✅ Database "fmpdata" exists');
        } else {
            console.log('⚠️  Database "fmpdata" does not exist. Run: createdb fmpdata');
        }
        
        await db.disconnect();
    } catch (error) {
        console.error('❌ Database connection failed:', (error as Error).message);
        process.exit(1);
    }
}

async function testFMPConnection() {
    console.log('\nTesting FMP API connection...');
    const apiKey = process.env.FMP_API_KEY;
    
    if (!apiKey) {
        console.error('❌ FMP_API_KEY not found in environment variables');
        return;
    }
    
    try {
        const response = await axios.get(
            `https://financialmodelingprep.com/api/v3/quote/AAPL?apikey=${apiKey}`
        );
        
        if (response.data && response.data.length > 0) {
            console.log('✅ FMP API connected successfully!');
            console.log('   AAPL current price:', response.data[0].price);
        } else {
            console.log('⚠️  FMP API returned no data');
        }
    } catch (error: any) {
        if (error.response?.status === 401) {
            console.error('❌ FMP API key is invalid');
        } else {
            console.error('❌ FMP API connection failed:', error.message);
        }
    }
}

async function checkEnvironmentVariables() {
    console.log('\nChecking environment variables...');
    const required = [
        'FMP_API_KEY',
        'DB_HOST',
        'DB_PORT',
        'DB_NAME',
        'DB_USER'
    ];
    
    let allPresent = true;
    for (const varName of required) {
        if (process.env[varName]) {
            console.log(`✅ ${varName}: ${varName === 'FMP_API_KEY' ? '***' : process.env[varName]}`);
        } else {
            console.log(`❌ ${varName}: NOT SET`);
            allPresent = false;
        }
    }
    
    if (!allPresent) {
        console.log('\n⚠️  Please set all required environment variables in .env file');
    }
}

async function main() {
    console.log('=================================');
    console.log('FMP Data System - Connection Test');
    console.log('=================================\n');
    
    await checkEnvironmentVariables();
    await testDatabaseConnection();
    await testFMPConnection();
    
    console.log('\n=================================');
    console.log('Test completed!');
    console.log('=================================');
}

main().catch(console.error);