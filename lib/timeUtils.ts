export interface InGameTimeState {
  day: number;
  minutes: number; // 0 to 1439
  formatted: string; // e.g. "День 1 • 18:00"
  timeOfDayRu: string; // e.g. "Вечер / Сумерки"
}

export function formatInGameClock(day: number, totalMinutes: number): string {
  const clockDay = Math.max(1, day + Math.floor(totalMinutes / 1440));
  const clockMinsTotal = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(clockMinsTotal / 60);
  const mins = Math.floor(clockMinsTotal % 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  return `День ${clockDay} • ${hh}:${mm}`;
}

export function getTimeOfDayDescription(minutes: number): string {
  const normalizedMins = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMins / 60);

  if (hours >= 5 && hours < 12) {
    return 'Утро (восход солнца, свежесть, пробуждение мира)';
  } else if (hours >= 12 && hours < 17) {
    return 'День / Полдень (яркое солнце в зените, тепло, хорошая видимость)';
  } else if (hours >= 17 && hours < 22) {
    return 'Вечер / Сумерки (закат, сгущаются тени, зажигаются огни)';
  } else {
    return 'Ночь / Полночь (глубокая тьма, лунный свет, тишина, нужен источник света)';
  }
}

const WORD_TO_NUMBER: Record<string, number> = {
  'один': 1, 'одного': 1, 'первого': 1, 'час': 1, 'часа': 1,
  'два': 2, 'двух': 2, 'второго': 2,
  'три': 3, 'трех': 3, 'трёх': 3, 'третьего': 3,
  'четыре': 4, 'четырех': 4, 'четырёх': 4, 'четвертого': 4,
  'пять': 5, 'пяти': 5, 'пятого': 5,
  'шесть': 6, 'шести': 6, 'шестого': 6,
  'семь': 7, 'семи': 7, 'седьмого': 7,
  'восемь': 8, 'восьми': 8, 'восьмого': 8,
  'девять': 9, 'девяти': 9, 'девятого': 9,
  'десять': 10, 'десяти': 10, 'десятого': 10,
  'одиннадцать': 11, 'одиннадцати': 11,
  'двенадцать': 12, 'двенадцати': 12,
};

function parseWordOrDigit(val: string): number | null {
  if (!val) return null;
  const clean = val.toLowerCase().trim();
  const digit = parseInt(clean, 10);
  if (!isNaN(digit)) return digit;
  if (WORD_TO_NUMBER[clean] !== undefined) return WORD_TO_NUMBER[clean];
  return null;
}

export function parseAndAdvanceTime(
  currentDay: number,
  currentMinutes: number,
  actionText: string = '',
  narrativeText: string = '',
  explicitMinutes?: number,
  explicitNewTime?: string,
  explicitNewDay?: number
): { nextDay: number; nextMinutes: number; timePassedMinutes: number; formatted: string } {
  const normCurrentMins = ((currentMinutes % 1440) + 1440) % 1440;
  const combinedText = `${actionText}\n${narrativeText}`.toLowerCase();

  // 1. First priority: Target time phrases in Action or Narrative ("до 6 вечера", "до 18:00", "до 8 утра", "сейчас около 6 вечера")
  const targetTimeRegexes = [
    // "до 18:00", "до 06:30"
    /до\s*(\d{1,2})[:.](\d{2})/i,
    // "до 6 вечера", "до шести часов вечера", "до 11 утра", "до 2 часов ночи", "до 6"
    /до\s*(?:часов|часа|часу)?\s*(\d+|одиннадцати|двенадцати|первого|двух|трех|трёх|четырех|четырёх|пяти|шести|семи|восьми|девяти|десяти|одного|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\s*(?:часов|часа)?\s*(вечера|ночи|утра|дня)?/i,
    // "сейчас около шести часов вечера", "на часах 18:00", "время около 6 вечера"
    /(?:сейчас|на часах|время|наступило|на часах около|время близится к|около)\s*(\d+|одиннадцати|двенадцати|первого|двух|трех|трёх|четырех|четырёх|пяти|шести|семи|восьми|девяти|десяти|одного|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\s*(?:часов|часа)?\s*(вечера|ночи|утра|дня)?/i,
  ];

  for (const rx of targetTimeRegexes) {
    const m = combinedText.match(rx);
    if (m) {
      let rawHour: number | null = null;
      let rawMin = 0;
      let period = '';

      if (m[2] && m[2].length === 2 && !isNaN(parseInt(m[2], 10))) {
        // HH:MM format
        rawHour = parseInt(m[1], 10);
        rawMin = parseInt(m[2], 10);
      } else {
        rawHour = parseWordOrDigit(m[1]);
        period = (m[2] || m[3] || '').trim();
      }

      if (rawHour !== null && rawHour >= 0 && rawHour <= 24) {
        let finalHour = rawHour;
        if (period.includes('вечер') && finalHour < 12) {
          finalHour += 12;
        } else if (period.includes('дня') && finalHour < 8) {
          finalHour += 12;
        } else if (period.includes('ноч') && finalHour === 12) {
          finalHour = 0;
        } else if (!period && finalHour <= 8 && normCurrentMins >= 12 * 60) {
          // If currently afternoon and user says "до 6", they mean 6 PM (18:00)
          finalHour += 12;
        }

        const targetMins = (finalHour % 24) * 60 + rawMin;
        let diff = targetMins - normCurrentMins;
        let resDay = currentDay;
        if (diff <= 0) {
          // Crosses into next day
          diff += 1440;
          resDay += 1;
        }

        if (diff > 0) {
          return {
            nextDay: resDay,
            nextMinutes: targetMins,
            timePassedMinutes: diff,
            formatted: formatInGameClock(resDay, targetMins),
          };
        }
      }
    }
  }

  // 2. Second priority: Target landmarks: "до заката", "до вечера", "до темноты", "до полуночи", "до рассвета", "до утра"
  if (/до\s*(?:заката|вечера|сумерек|темноты)/i.test(combinedText) || /к вечеру|на закате|солнце село|сгустились сумерки/i.test(narrativeText.toLowerCase())) {
    const eveningTarget = 18 * 60 + 30; // 18:30
    let diff = eveningTarget - normCurrentMins;
    let resDay = currentDay;
    if (diff <= 0) {
      diff += 1440;
      resDay += 1;
    }
    return {
      nextDay: resDay,
      nextMinutes: eveningTarget,
      timePassedMinutes: Math.max(30, diff),
      formatted: formatInGameClock(resDay, eveningTarget),
    };
  }

  if (/до\s*(?:ночи|полуночи)/i.test(combinedText) || /наступила ночь|глубокая ночь|полночь/i.test(narrativeText.toLowerCase())) {
    const nightTarget = 23 * 60 + 30; // 23:30
    let diff = nightTarget - normCurrentMins;
    let resDay = currentDay;
    if (diff <= 0) {
      diff += 1440;
      resDay += 1;
    }
    return {
      nextDay: resDay,
      nextMinutes: nightTarget,
      timePassedMinutes: Math.max(60, diff),
      formatted: formatInGameClock(resDay, nightTarget),
    };
  }

  if (/до\s*(?:утра|рассвета)/i.test(combinedText) || /на следующее утро|к утру|на рассвете|на следующий день/i.test(narrativeText.toLowerCase())) {
    const morningTarget = 7 * 60 + 30; // 07:30
    let diff = morningTarget - normCurrentMins;
    let resDay = currentDay + 1;
    if (diff <= 0) {
      diff += 1440;
    }
    return {
      nextDay: resDay,
      nextMinutes: morningTarget,
      timePassedMinutes: Math.max(120, diff),
      formatted: formatInGameClock(resDay, morningTarget),
    };
  }

  // 3. Third priority: Explicit new_time from AI (e.g. "18:00", "День 2 • 08:30") if it actually advances time
  let targetDay = explicitNewDay || currentDay;
  if (explicitNewTime && explicitNewTime.trim().length > 0) {
    const timeMatch = explicitNewTime.match(/(?:День\s*(\d+)\s*•?\s*)?(\d{1,2})[:.](\d{2})/i);
    if (timeMatch) {
      if (timeMatch[1]) targetDay = parseInt(timeMatch[1], 10);
      const h = parseInt(timeMatch[2], 10);
      const m = parseInt(timeMatch[3], 10);
      if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
        const targetMins = h * 60 + m;
        let diff = targetMins - normCurrentMins;
        if (!timeMatch[1] && targetMins < normCurrentMins) {
          // Crossed into next day
          diff += 1440;
          targetDay = currentDay + 1;
        }
        if (diff > 0 || (timeMatch[1] && parseInt(timeMatch[1], 10) > currentDay)) {
          return {
            nextDay: targetDay,
            nextMinutes: targetMins,
            timePassedMinutes: Math.max(15, diff),
            formatted: formatInGameClock(targetDay, targetMins),
          };
        }
      }
    }
  }

  // 4. Fourth priority: Explicit time_passed_minutes from AI if greater than default 15
  if (explicitMinutes !== undefined && explicitMinutes > 15) {
    let nextM = currentMinutes + explicitMinutes;
    let nextD = currentDay;
    if (nextM >= 1440) {
      nextD += Math.floor(nextM / 1440);
      nextM = nextM % 1440;
    }
    return {
      nextDay: nextD,
      nextMinutes: nextM,
      timePassedMinutes: explicitMinutes,
      formatted: formatInGameClock(nextD, nextM),
    };
  }

  // 5. Fifth priority: Explicit duration matches in text: "на 10 часов", "спустя 3 часа", "путь занял 5 дней"
  const hoursMatch = combinedText.match(/(?:спустя|через|путь занял|переход продлился|прошло|заняло|в течение|на|около)\s*(\d+|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|двенадцать)\s*(?:час[а-я]*|ч\b)/i);
  if (hoursMatch) {
    const h = parseWordOrDigit(hoursMatch[1]);
    if (h && h > 0) {
      const minsToAdd = h * 60;
      let nextM = currentMinutes + minsToAdd;
      let nextD = currentDay;
      if (nextM >= 1440) {
        nextD += Math.floor(nextM / 1440);
        nextM = nextM % 1440;
      }
      return {
        nextDay: nextD,
        nextMinutes: nextM,
        timePassedMinutes: minsToAdd,
        formatted: formatInGameClock(nextD, nextM),
      };
    }
  }

  const daysMatch = combinedText.match(/(?:спустя|через|путь занял|переход продлился|прошло|заняло|в течение|на)\s*(\d+|один|два|три|четыре|пять)\s*(?:дн[а-я]*|день|дня|дней)/i);
  if (daysMatch) {
    const d = parseWordOrDigit(daysMatch[1]);
    if (d && d > 0) {
      const minsToAdd = d * 1440;
      const nextD = currentDay + d;
      return {
        nextDay: nextD,
        nextMinutes: normCurrentMins,
        timePassedMinutes: minsToAdd,
        formatted: formatInGameClock(nextD, normCurrentMins),
      };
    }
  }

  const minutesMatch = combinedText.match(/(?:спустя|через|прошло|заняло|на)\s*(\d+)\s*(?:минут[а-я]*|мин\b)/i);
  if (minutesMatch) {
    const m = parseInt(minutesMatch[1], 10);
    if (!isNaN(m) && m > 0) {
      let nextM = currentMinutes + m;
      let nextD = currentDay;
      if (nextM >= 1440) {
        nextD += Math.floor(nextM / 1440);
        nextM = nextM % 1440;
      }
      return {
        nextDay: nextD,
        nextMinutes: nextM,
        timePassedMinutes: m,
        formatted: formatInGameClock(nextD, nextM),
      };
    }
  }

  // 6. Rest actions
  if (/коротк\w*\s+отдых|привал/i.test(combinedText)) {
    const minsToAdd = 60;
    let nextM = currentMinutes + minsToAdd;
    let nextD = currentDay;
    if (nextM >= 1440) {
      nextD += Math.floor(nextM / 1440);
      nextM = nextM % 1440;
    }
    return {
      nextDay: nextD,
      nextMinutes: nextM,
      timePassedMinutes: minsToAdd,
      formatted: formatInGameClock(nextD, nextM),
    };
  }

  if (/длительн\w*\s+отдых|ночлег|ночевк/i.test(combinedText)) {
    const minsToAdd = 480; // 8 hours
    let nextM = currentMinutes + minsToAdd;
    let nextD = currentDay;
    if (nextM >= 1440) {
      nextD += Math.floor(nextM / 1440);
      nextM = nextM % 1440;
    }
    return {
      nextDay: nextD,
      nextMinutes: nextM,
      timePassedMinutes: minsToAdd,
      formatted: formatInGameClock(nextD, nextM),
    };
  }

  // 7. Default fast action: 15 minutes
  const defMins = (explicitMinutes && explicitMinutes > 0) ? explicitMinutes : 15;
  let nextM = currentMinutes + defMins;
  let nextD = currentDay;
  if (nextM >= 1440) {
    nextD += Math.floor(nextM / 1440);
    nextM = nextM % 1440;
  }
  return {
    nextDay: nextD,
    nextMinutes: nextM,
    timePassedMinutes: defMins,
    formatted: formatInGameClock(nextD, nextM),
  };
}
