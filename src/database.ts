import { Pool } from 'pg';

export interface SeriesData {
  series_id: string;
  title: string;
  units: string;
  frequency: string;
  observation_start: string;
  observation_end: string;
  last_updated: string;
  notes?: string;
}

export interface ObservationData {
  series_id: string;
  observation_date: string;
  value: number;
}

export interface LatestValueData {
  series_id: string;
  title: string;
  units: string;
  frequency: string;
  observation_date: string;
  value: number;
}

export interface TimeSeriesData {
  series_id: string;
  title: string;
  data: Array<{
    date: string;
    value: number;
  }>;
}

export class DatabaseClient {
  public pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fmpdata',
      user: process.env.DB_USER || 'parthbhatt',
      password: process.env.DB_PASSWORD || '',
    });
  }

  async connect() {
    await this.pool.connect();
  }

  async disconnect() {
    await this.pool.end();
  }

  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  async getAllSeries(): Promise<SeriesData[]> {
    const result = await this.pool.query(`
      SELECT 
        series_id,
        title,
        units,
        frequency,
        observation_start,
        observation_end,
        last_updated,
        notes
      FROM economic_data.series
      ORDER BY series_id
    `);
    return result.rows;
  }

  async getLatestValues(): Promise<LatestValueData[]> {
    const result = await this.pool.query(`
      SELECT 
        series_id,
        title,
        units,
        frequency,
        observation_date,
        value
      FROM economic_data.latest_values
      WHERE value IS NOT NULL
      ORDER BY series_id
    `);
    return result.rows;
  }

  async getSeriesData(seriesId: string, limit: number = 1000): Promise<TimeSeriesData> {
    const seriesResult = await this.pool.query(`
      SELECT title FROM economic_data.series WHERE series_id = $1
    `, [seriesId]);

    const observationsResult = await this.pool.query(`
      SELECT 
        observation_date,
        value
      FROM economic_data.observations
      WHERE series_id = $1
      ORDER BY observation_date DESC
      LIMIT $2
    `, [seriesId, limit]);

    return {
      series_id: seriesId,
      title: seriesResult.rows[0]?.title || seriesId,
      data: observationsResult.rows.map(row => ({
        date: row.observation_date.toISOString().split('T')[0],
        value: parseFloat(row.value)
      })).reverse() // Reverse to get chronological order
    };
  }

  async getMultipleSeriesData(seriesIds: string[], limit: number = 1000): Promise<TimeSeriesData[]> {
    const results: TimeSeriesData[] = [];
    
    for (const seriesId of seriesIds) {
      try {
        const data = await this.getSeriesData(seriesId, limit);
        results.push(data);
      } catch (error) {
        console.error(`Error fetching data for ${seriesId}:`, error);
      }
    }
    
    return results;
  }

  async getSeriesStatistics(seriesId: string) {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as observation_count,
        MIN(observation_date) as first_observation,
        MAX(observation_date) as last_observation,
        MIN(value) as min_value,
        MAX(value) as max_value,
        AVG(value) as avg_value,
        STDDEV(value) as stddev_value
      FROM economic_data.observations
      WHERE series_id = $1
    `, [seriesId]);

    return result.rows[0];
  }

  async searchSeries(searchTerm: string): Promise<SeriesData[]> {
    const result = await this.pool.query(`
      SELECT 
        series_id,
        title,
        units,
        frequency,
        observation_start,
        observation_end,
        last_updated,
        notes
      FROM economic_data.series
      WHERE title ILIKE $1 OR series_id ILIKE $1 OR notes ILIKE $1
      ORDER BY 
        CASE 
          WHEN series_id ILIKE $1 THEN 1
          WHEN title ILIKE $1 THEN 2
          ELSE 3
        END,
        series_id
    `, [`%${searchTerm}%`]);
    
    return result.rows;
  }

  async getRecentObservations(days: number = 30): Promise<ObservationData[]> {
    const result = await this.pool.query(`
      SELECT 
        series_id,
        observation_date,
        value
      FROM economic_data.observations
      WHERE observation_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY observation_date DESC, series_id
    `);
    
    return result.rows.map(row => ({
      series_id: row.series_id,
      observation_date: row.observation_date.toISOString().split('T')[0],
      value: parseFloat(row.value)
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}