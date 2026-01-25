/**
 * Advanced EPG Service
 * EPG search, reminders, recording scheduler, catch-up TV support
 */

import { db } from '@db';
import { 
  epgData,
  epgReminders,
  epgRecordings,
  catchupContent,
  InsertEpgReminder,
  InsertEpgRecording,
  InsertCatchupContent
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte, like, or } from 'drizzle-orm';

export interface EpgProgram {
  id: number;
  channelId: number;
  channelName?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category?: string;
  rating?: string;
  posterUrl?: string;
}

export interface SearchFilters {
  query?: string;
  channelId?: number;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  rating?: string;
}

export interface ReminderSchedule {
  programId: number;
  userId: number;
  reminderTime: Date; // How many minutes before program starts
  notificationType: 'email' | 'push' | 'sms';
}

export interface RecordingSchedule {
  programId: number;
  userId: number;
  quality: 'sd' | 'hd' | 'fhd';
  startPadding: number; // Minutes before program
  endPadding: number; // Minutes after program
}

/**
 * Search EPG Programs
 * Full-text search with filters
 */
export async function searchEpgPrograms(filters: SearchFilters, limit = 50, offset = 0): Promise<EpgProgram[]> {
  let query = db.select().from(epgData);

  const conditions = [];

  if (filters.query) {
    conditions.push(
      or(
        like(epgData.title, `%${filters.query}%`),
        like(epgData.description, `%${filters.query}%`)
      )
    );
  }

  if (filters.channelId) {
    conditions.push(eq(epgData.channelId, filters.channelId));
  }

  if (filters.category) {
    conditions.push(eq(epgData.category, filters.category));
  }

  if (filters.startDate) {
    conditions.push(gte(epgData.startTime, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(epgData.endTime, filters.endDate));
  }

  if (filters.rating) {
    conditions.push(eq(epgData.rating, filters.rating));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const programs = await query
    .orderBy(epgData.startTime)
    .limit(limit)
    .offset(offset);

  return programs;
}

/**
 * Get Current & Upcoming Programs for Channel
 */
export async function getChannelSchedule(channelId: number, hours = 24): Promise<EpgProgram[]> {
  const now = new Date();
  const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return await db.select()
    .from(epgData)
    .where(and(
      eq(epgData.channelId, channelId),
      gte(epgData.endTime, now),
      lte(epgData.startTime, endTime)
    ))
    .orderBy(epgData.startTime);
}

/**
 * Create Program Reminder
 */
export async function createReminder(data: {
  programId: number;
  userId: number;
  reminderMinutes: number;
  notificationType: 'email' | 'push' | 'sms';
}): Promise<any> {
  // Get program details
  const program = await db.select()
    .from(epgData)
    .where(eq(epgData.id, data.programId))
    .limit(1);

  if (!program[0]) {
    throw new Error('Program not found');
  }

  const reminderTime = new Date(
    program[0].startTime.getTime() - data.reminderMinutes * 60 * 1000
  );

  const result = await db.insert(epgReminders)
    .values({
      programId: data.programId,
      userId: data.userId,
      reminderTime: reminderTime,
      notificationType: data.notificationType,
      sent: false
    })
    .returning();

  return result[0];
}

/**
 * Get User Reminders
 */
export async function getUserReminders(userId: number, includeExpired = false): Promise<any[]> {
  let query = db.select({
    reminder: epgReminders,
    program: epgData
  })
  .from(epgReminders)
  .leftJoin(epgData, eq(epgData.id, epgReminders.programId))
  .where(eq(epgReminders.userId, userId));

  if (!includeExpired) {
    query = query.where(and(
      eq(epgReminders.userId, userId),
      eq(epgReminders.sent, false),
      gte(epgReminders.reminderTime, new Date())
    ));
  }

  return await query.orderBy(epgReminders.reminderTime);
}

/**
 * Process Pending Reminders
 * Called by cron job to send reminders
 */
export async function processPendingReminders(): Promise<number> {
  const now = new Date();
  
  const pendingReminders = await db.select({
    reminder: epgReminders,
    program: epgData
  })
  .from(epgReminders)
  .leftJoin(epgData, eq(epgData.id, epgReminders.programId))
  .where(and(
    eq(epgReminders.sent, false),
    lte(epgReminders.reminderTime, now)
  ));

  let sentCount = 0;

  for (const { reminder, program } of pendingReminders) {
    if (!program) continue;

    // Send notification based on type
    try {
      await sendReminder(reminder, program);
      
      // Mark as sent
      await db.update(epgReminders)
        .set({ sent: true, sentAt: new Date() })
        .where(eq(epgReminders.id, reminder.id));
      
      sentCount++;
    } catch (error) {
      console.error(`Failed to send reminder ${reminder.id}:`, error);
    }
  }

  return sentCount;
}

/**
 * Send Reminder Notification
 */
async function sendReminder(reminder: any, program: any): Promise<void> {
  const message = `Reminder: "${program.title}" starts in ${Math.round((program.startTime.getTime() - Date.now()) / 60000)} minutes on ${program.channelName || 'Channel'}`;

  switch (reminder.notificationType) {
    case 'email':
      // Integrate with email service
      console.log(`📧 Email reminder: ${message}`);
      break;
    
    case 'push':
      // Integrate with push notification service
      console.log(`📱 Push notification: ${message}`);
      break;
    
    case 'sms':
      // Integrate with SMS service
      console.log(`📲 SMS: ${message}`);
      break;
  }
}

/**
 * Schedule Recording
 */
export async function scheduleRecording(data: {
  programId: number;
  userId: number;
  quality: 'sd' | 'hd' | 'fhd';
  startPadding?: number;
  endPadding?: number;
}): Promise<any> {
  const program = await db.select()
    .from(epgData)
    .where(eq(epgData.id, data.programId))
    .limit(1);

  if (!program[0]) {
    throw new Error('Program not found');
  }

  const startTime = new Date(
    program[0].startTime.getTime() - (data.startPadding || 2) * 60 * 1000
  );
  const endTime = new Date(
    program[0].endTime.getTime() + (data.endPadding || 5) * 60 * 1000
  );

  const result = await db.insert(epgRecordings)
    .values({
      programId: data.programId,
      userId: data.userId,
      scheduledStart: startTime,
      scheduledEnd: endTime,
      quality: data.quality,
      status: 'scheduled'
    })
    .returning();

  return result[0];
}

/**
 * Get User Recordings
 */
export async function getUserRecordings(userId: number, status?: string): Promise<any[]> {
  let query = db.select({
    recording: epgRecordings,
    program: epgData
  })
  .from(epgRecordings)
  .leftJoin(epgData, eq(epgData.id, epgRecordings.programId))
  .where(eq(epgRecordings.userId, userId));

  if (status) {
    query = query.where(and(
      eq(epgRecordings.userId, userId),
      eq(epgRecordings.status, status)
    ));
  }

  return await query.orderBy(desc(epgRecordings.scheduledStart));
}

/**
 * Update Recording Status
 */
export async function updateRecordingStatus(
  recordingId: number,
  status: 'scheduled' | 'recording' | 'completed' | 'failed',
  fileUrl?: string
): Promise<any> {
  const updates: any = { status };

  if (status === 'recording') {
    updates.actualStart = new Date();
  } else if (status === 'completed') {
    updates.actualEnd = new Date();
    if (fileUrl) updates.fileUrl = fileUrl;
  } else if (status === 'failed') {
    updates.actualEnd = new Date();
  }

  const result = await db.update(epgRecordings)
    .set(updates)
    .where(eq(epgRecordings.id, recordingId))
    .returning();

  return result[0];
}

/**
 * Create Catch-up Content
 * Archive programs for catch-up TV
 */
export async function createCatchupContent(data: {
  programId: number;
  channelId: number;
  fileUrl: string;
  duration: number;
  availableUntil: Date;
}): Promise<any> {
  const result = await db.insert(catchupContent)
    .values({
      programId: data.programId,
      channelId: data.channelId,
      fileUrl: data.fileUrl,
      duration: data.duration,
      availableUntil: data.availableUntil,
      views: 0
    })
    .returning();

  return result[0];
}

/**
 * Get Catch-up Content for Channel
 */
export async function getChannelCatchup(channelId: number, days = 7): Promise<any[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return await db.select({
    catchup: catchupContent,
    program: epgData
  })
  .from(catchupContent)
  .leftJoin(epgData, eq(epgData.id, catchupContent.programId))
  .where(and(
    eq(catchupContent.channelId, channelId),
    gte(catchupContent.createdAt, cutoff),
    gte(catchupContent.availableUntil, new Date())
  ))
  .orderBy(desc(catchupContent.createdAt));
}

/**
 * Track Catch-up View
 */
export async function trackCatchupView(catchupId: number): Promise<void> {
  await db.update(catchupContent)
    .set({ 
      views: sql`${catchupContent.views} + 1`,
      lastViewed: new Date()
    })
    .where(eq(catchupContent.id, catchupId));
}

/**
 * Clean Up Expired Content
 */
export async function cleanupExpiredCatchup(): Promise<number> {
  const result = await db.delete(catchupContent)
    .where(lte(catchupContent.availableUntil, new Date()));

  return result.rowCount || 0;
}

/**
 * Import EPG Data from XMLTV
 */
export async function importEpgFromXmltv(xmltvUrl: string): Promise<number> {
  // This is a placeholder - actual implementation would parse XMLTV format
  console.log(`Importing EPG data from: ${xmltvUrl}`);
  
  // Parse XMLTV and insert programs
  // Return count of imported programs
  return 0;
}

/**
 * Auto-Update EPG
 * Scheduled task to refresh EPG data
 */
export async function autoUpdateEpg(): Promise<void> {
  console.log('Auto-updating EPG data...');
  
  // Implementation would:
  // 1. Fetch from configured EPG sources
  // 2. Parse and normalize data
  // 3. Update database
  // 4. Clean up old programs
}
