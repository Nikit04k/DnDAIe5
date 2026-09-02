import { NextResponse } from 'next/server';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const addresses: Array<{ name: string; address: string; family: string; isInternal: boolean }> = [];

    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;

      for (const net of netList) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' || (net.family as any) === 4) {
          addresses.push({
            name,
            address: net.address,
            family: 'IPv4',
            isInternal: net.internal,
          });
        }
      }
    }

    // Sort to prioritize local LAN addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x) over internal localhost
    const lanAddresses = addresses.filter((a) => !a.isInternal);
    const primaryLanIp = lanAddresses.length > 0 ? lanAddresses[0].address : '127.0.0.1';

    return NextResponse.json({
      success: true,
      primaryLanIp,
      lanAddresses: lanAddresses.map((a) => a.address),
      allInterfaces: addresses,
      port: 3000,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        primaryLanIp: '127.0.0.1',
        lanAddresses: ['127.0.0.1'],
        error: err?.message || 'Failed to detect network interfaces',
      },
      { status: 500 }
    );
  }
}
