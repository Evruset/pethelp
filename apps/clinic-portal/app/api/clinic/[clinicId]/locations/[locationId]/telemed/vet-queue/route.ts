import { NextResponse } from 'next/server';

function moved() {
  return NextResponse.json({
    code: 'TELEMED_WORKSPACE_MOVED',
    message: 'Use the platform veterinarian workspace.',
  }, { status: 410 });
}

export async function GET() { return moved(); }
export async function POST() { return moved(); }
export async function PATCH() { return moved(); }
