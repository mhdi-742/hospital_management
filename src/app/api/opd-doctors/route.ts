import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'src', 'data', 'opd_doctors.json');
    const fileContents = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to load OPD doctors schedule data:', error);
    return NextResponse.json(
      { error: 'Failed to load OPD doctors schedule' },
      { status: 500 }
    );
  }
}
