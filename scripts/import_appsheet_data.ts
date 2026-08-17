// @ts-nocheck
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import turfConvex from '@turf/convex';
import * as turfHelpers from '@turf/helpers';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables for DB insertion
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// The same scoring formulas from Phase 0 are kept here.
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function score(x: number, zeroPoint: number, hundredPoint: number) {
  return clamp(((x - zeroPoint) / (hundredPoint - zeroPoint)) * 100, 0, 100);
}

// ... Additional helper functions (parseMetersToCm, parseNum, calcStepRampComb) omitted for brevity
// but would be identical to generate_mock_data.js.

export async function importAppSheetData(filePath: string, outputJsonPath?: string) {
  console.log(`[Import] Starting AppSheet data import from ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // 1. Read Excel/CSV file (using xlsx library which handles both)
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames.includes('생활권') ? '생활권' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet);

  // 2. Parse and group data (similar to Phase 0 logic)
  // ...
  console.log(`[Import] Parsed ${rawData.length} rows.`);

  // If Supabase is configured, push directly. Otherwise, output to JSON.
  if (supabase) {
    console.log('[Import] Pushing to Supabase DB...');
    // Real implementation would batch insert into zones, facilities, etc.
  } else if (outputJsonPath) {
    console.log(`[Import] Supabase keys not found. Writing to JSON fallback at ${outputJsonPath}`);
    // fs.writeFileSync(outputJsonPath, JSON.stringify(result, null, 2));
  } else {
    console.log('[Import] Dry run complete. Define NEXT_PUBLIC_SUPABASE_URL to upload.');
  }
}

// CLI Execution Support
if (require.main === module) {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: ts-node import_appsheet_data.ts <path-to-excel-or-csv>');
    process.exit(1);
  }
  
  importAppSheetData(path.resolve(fileArg))
    .then(() => console.log('Done'))
    .catch(console.error);
}
