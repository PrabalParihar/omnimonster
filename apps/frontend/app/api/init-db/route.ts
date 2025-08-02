import { NextResponse } from 'next/server';
import { FusionDatabase, getDatabaseConfig } from '@swap-sage/shared';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    console.log('Initializing database schema...');
    
    const db = FusionDatabase.getInstance(getDatabaseConfig());
    
    // Read the schema file
    const schemaPath = path.join(process.cwd(), '../../packages/shared/src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await db.query(schema);
    
    console.log('Database schema initialized successfully');
    
    return NextResponse.json({ 
      message: 'Database schema initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ 
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 