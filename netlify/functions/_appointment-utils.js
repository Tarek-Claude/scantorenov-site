const TIME_ZONE = 'Europe/Paris';

const APPOINTMENT_RULES = {
  phone_call: {
    durationMinutes: 30,
    minLeadMinutes: 120,
    horizonDays: 30,
    startOffsetDays: 0,
  },
  scan_3d: {
    durationMinutes: 240,
    minLeadMinutes: 24 * 60,
    horizonDays: 60,
    startOffsetDays: 1,
  },
};

const WEEKDAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map();

function getFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      })
    );
  }

  return formatterCache.get(timeZone);
}

function getZonedParts(date, timeZone = TIME_ZONE) {
  const values = {};

  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: WEEKDAY_MAP[values.weekday],
  };
}

function getOffsetMilliseconds(date, timeZone = TIME_ZONE) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

function isIsoDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateOnly(value) {
  if (!isIsoDateOnly(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function shiftDateString(dateString, days) {
  const parsed = parseDateOnly(dateString);

  if (!parsed) {
    throw new Error(`Invalid ISO date: ${dateString}`);
  }

  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return shifted.toISOString().slice(0, 10);
}

function formatDateInTimeZone(date, timeZone = TIME_ZONE) {
  const parts = getZonedParts(date, timeZone);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function formatTimeInTimeZone(date, timeZone = TIME_ZONE) {
  const parts = getZonedParts(date, timeZone);
  return [
    String(parts.hour).padStart(2, '0'),
    String(parts.minute).padStart(2, '0'),
  ].join(':');
}

function zonedDateTimeToUtc(dateString, timeString = '00:00:00', timeZone = TIME_ZONE) {
  const parsedDate = parseDateOnly(dateString);

  if (!parsedDate) {
    throw new Error(`Invalid ISO date: ${dateString}`);
  }

  const [hour = 0, minute = 0, second = 0] = String(timeString)
    .split(':')
    .map((value) => Number(value));

  const utcGuess = Date.UTC(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    hour,
    minute,
    second
  );

  let offset = getOffsetMilliseconds(new Date(utcGuess), timeZone);
  let resolved = utcGuess - offset;
  const correctedOffset = getOffsetMilliseconds(new Date(resolved), timeZone);

  if (correctedOffset !== offset) {
    resolved = utcGuess - correctedOffset;
  }

  return new Date(resolved);
}

function getCurrentDateInTimeZone(now = new Date(), timeZone = TIME_ZONE) {
  return formatDateInTimeZone(now, timeZone);
}

function isBusinessDay(dateString, timeZone = TIME_ZONE) {
  const weekday = getZonedParts(zonedDateTimeToUtc(dateString, '12:00:00', timeZone), timeZone).weekday;
  return weekday >= 1 && weekday <= 6;
}

function buildDayTimeStrings(type) {
  if (type === 'scan_3d') {
    return ['08:00', '14:00'];
  }

  if (type === 'phone_call') {
    const slots = [];
    for (let minutes = 8 * 60; minutes < 20 * 60; minutes += 30) {
      const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mins = String(minutes % 60).padStart(2, '0');
      slots.push(`${hours}:${mins}`);
    }
    return slots;
  }

  return [];
}

function getRule(type) {
  return APPOINTMENT_RULES[type] || null;
}

function getBookingWindow(type, now = new Date(), timeZone = TIME_ZONE) {
  const rule = getRule(type);
  if (!rule) return null;

  const firstDate = shiftDateString(getCurrentDateInTimeZone(now, timeZone), rule.startOffsetDays);
  const lastDate = shiftDateString(firstDate, rule.horizonDays - 1);
  const minStart = new Date(now.getTime() + rule.minLeadMinutes * 60 * 1000);

  return { firstDate, lastDate, minStart };
}

function isSlotInBookingWindow(type, start, now = new Date(), timeZone = TIME_ZONE) {
  const window = getBookingWindow(type, now, timeZone);
  if (!window) return false;

  const slotDate = formatDateInTimeZone(start, timeZone);
  if (slotDate < window.firstDate || slotDate > window.lastDate) {
    return false;
  }

  return start.getTime() >= window.minStart.getTime();
}

function isSlotMatchingRules(type, start, timeZone = TIME_ZONE) {
  const slotDate = formatDateInTimeZone(start, timeZone);
  const slotTime = formatTimeInTimeZone(start, timeZone);

  return isBusinessDay(slotDate, timeZone) && buildDayTimeStrings(type).includes(slotTime);
}

function isSlotBookable(type, start, now = new Date(), timeZone = TIME_ZONE) {
  return isSlotMatchingRules(type, start, timeZone) && isSlotInBookingWindow(type, start, now, timeZone);
}

function generateSlots(type, fromDate, toDate, now = new Date(), timeZone = TIME_ZONE) {
  const rule = getRule(type);
  if (!rule) return [];

  const slots = [];

  for (let dateCursor = fromDate; dateCursor <= toDate; dateCursor = shiftDateString(dateCursor, 1)) {
    if (!isBusinessDay(dateCursor, timeZone)) {
      continue;
    }

    for (const timeString of buildDayTimeStrings(type)) {
      const start = zonedDateTimeToUtc(dateCursor, timeString, timeZone);
      slots.push({
        type,
        date: dateCursor,
        time: timeString,
        scheduledAt: start.toISOString(),
        durationMinutes: rule.durationMinutes,
        available: isSlotInBookingWindow(type, start, now, timeZone),
      });
    }
  }

  return slots;
}

function getDurationMinutes(appointment) {
  const raw = appointment && (appointment.duration_minutes ?? appointment.durationMinutes);
  const numeric = Number(raw);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const rule = getRule(appointment && appointment.type);
  return rule ? rule.durationMinutes : 30;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function appointmentsOverlap(startA, durationMinutesA, startB, durationMinutesB) {
  const endA = addMinutes(startA, durationMinutesA);
  const endB = addMinutes(startB, durationMinutesB);

  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}

function findConflictInList(appointments, requestedStart, requestedDurationMinutes) {
  for (const appointment of appointments || []) {
    const existingStart = new Date(appointment.scheduled_at || appointment.scheduledAt);
    if (Number.isNaN(existingStart.getTime())) {
      continue;
    }

    if (
      appointmentsOverlap(
        existingStart,
        getDurationMinutes(appointment),
        requestedStart,
        requestedDurationMinutes
      )
    ) {
      return appointment;
    }
  }

  return null;
}

async function findConflict(supabase, requestedStart, requestedDurationMinutes, options = {}) {
  const rangeStart = addMinutes(requestedStart, -24 * 60).toISOString();
  const rangeEnd = addMinutes(addMinutes(requestedStart, requestedDurationMinutes), 24 * 60).toISOString();

  let query = supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, type, status')
    .neq('status', 'cancelled')
    .gte('scheduled_at', rangeStart)
    .lt('scheduled_at', rangeEnd)
    .order('scheduled_at', { ascending: true });

  if (options.excludeAppointmentId) {
    query = query.neq('id', options.excludeAppointmentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return findConflictInList(data || [], requestedStart, requestedDurationMinutes);
}

module.exports = {
  APPOINTMENT_RULES,
  TIME_ZONE,
  appointmentsOverlap,
  findConflict,
  findConflictInList,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  generateSlots,
  getBookingWindow,
  getCurrentDateInTimeZone,
  getDurationMinutes,
  isIsoDateOnly,
  isSlotBookable,
  parseDateOnly,
  shiftDateString,
  zonedDateTimeToUtc,
};
