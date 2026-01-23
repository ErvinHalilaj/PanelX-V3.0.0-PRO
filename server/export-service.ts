import type { Line, Stream, User } from '@shared/schema';
import { format } from 'date-fns';

/**
 * Export Service for generating CSV, Excel, and M3U exports
 */

export class ExportService {
  /**
   * Convert data to CSV format
   */
  private toCSV(data: any[], headers: string[]): string {
    const csvRows = [];
    
    // Add header row
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Handle null/undefined
        if (value === null || value === undefined) return '';
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value).replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Export lines to CSV
   */
  exportLinesToCSV(lines: Line[]): string {
    const headers = [
      'id',
      'username',
      'password',
      'maxConnections',
      'enabled',
      'isTrial',
      'expDate',
      'createdAt',
      'lastActivity',
      'allowedIps',
      'allowedCountries',
      'lockedDeviceId',
      'lockedMac',
      'adminNotes',
      'resellerNotes',
    ];

    const data = lines.map(line => ({
      ...line,
      expDate: line.expDate ? format(new Date(line.expDate), 'yyyy-MM-dd HH:mm:ss') : '',
      createdAt: line.createdAt ? format(new Date(line.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
      lastActivity: line.lastActivity ? format(new Date(line.lastActivity), 'yyyy-MM-dd HH:mm:ss') : '',
      allowedIps: Array.isArray(line.allowedIps) ? line.allowedIps.join(';') : '',
      allowedCountries: Array.isArray(line.allowedCountries) ? line.allowedCountries.join(';') : '',
    }));

    return this.toCSV(data, headers);
  }

  /**
   * Export streams to CSV
   */
  exportStreamsToCSV(streams: Stream[]): string {
    const headers = [
      'id',
      'name',
      'sourceUrl',
      'streamType',
      'categoryId',
      'serverId',
      'onDemand',
      'isDirect',
      'monitorStatus',
      'createdAt',
      'epgChannelId',
      'streamIcon',
      'autoRestartHours',
      'delayMinutes',
    ];

    const data = streams.map(stream => ({
      ...stream,
      createdAt: stream.createdAt ? format(new Date(stream.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
    }));

    return this.toCSV(data, headers);
  }

  /**
   * Export users to CSV
   */
  exportUsersToCSV(users: User[]): string {
    const headers = [
      'id',
      'username',
      'role',
      'credits',
      'email',
      'createdAt',
      'resellerGroupId',
      'parentResellerId',
    ];

    const data = users.map(user => ({
      ...user,
      createdAt: user.createdAt ? format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
    }));

    return this.toCSV(data, headers);
  }

  /**
   * Export lines to M3U playlist
   */
  exportLinesToM3U(lines: Line[], baseUrl: string): string {
    const m3uLines = ['#EXTM3U'];
    
    for (const line of lines) {
      // Add line info as comment
      m3uLines.push(`#EXTINF:-1 tvg-id="${line.username}" tvg-name="${line.username}",${line.username}`);
      // Add playlist URL
      m3uLines.push(`${baseUrl}/get.php?username=${line.username}&password=${line.password}&type=m3u_plus&output=ts`);
    }
    
    return m3uLines.join('\n');
  }

  /**
   * Generate Excel workbook (simplified - returns CSV with Excel-compatible format)
   * For full Excel support, use a library like 'exceljs'
   */
  exportLinesToExcel(lines: Line[]): string {
    // For now, return CSV with UTF-8 BOM for Excel compatibility
    const csv = this.exportLinesToCSV(lines);
    return '\uFEFF' + csv; // UTF-8 BOM makes Excel recognize encoding
  }

  exportStreamsToExcel(streams: Stream[]): string {
    const csv = this.exportStreamsToCSV(streams);
    return '\uFEFF' + csv;
  }

  exportUsersToExcel(users: User[]): string {
    const csv = this.exportUsersToCSV(users);
    return '\uFEFF' + csv;
  }
}

export const exportService = new ExportService();
