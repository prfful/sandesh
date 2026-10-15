const MAX_PDF_PAGES = 5;

const createOcrWorker = async (onProgress) => {
  const { createWorker } = await import('tesseract.js');
  return createWorker('eng+hin', undefined, {
    logger: ({ status, progress }) => {
      onProgress?.({
        status: status || 'पाठ पहचाना जा रहा है',
        progress: Math.round((progress || 0) * 100),
      });
    },
  });
};

const recognizeImage = async (file, onProgress) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bitmap.width * scale);
  canvas.height = Math.ceil(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('निमंत्रण पढ़ने के लिए canvas उपलब्ध नहीं है');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let worker;
  try {
    worker = await createOcrWorker(onProgress);
    const result = await worker.recognize(canvas);
    return result.data.text || '';
  } finally {
    if (worker) await worker.terminate();
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
};

const extractPdfText = async (file, onProgress) => {
  const pdfjs = await import('pdfjs-dist');
  const { default: pdfWorkerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages = [];
  let worker;

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      onProgress?.({
        status: `PDF पृष्ठ ${pageNumber}/${pageCount} पढ़ा जा रहा है`,
        progress: Math.round(((pageNumber - 1) / pageCount) * 100),
      });

      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const textLines = new Map();
      textContent.items.forEach((item) => {
        if (!('str' in item) || !item.str.trim()) return;
        const y = Math.round(item.transform[5]);
        textLines.set(y, [...(textLines.get(y) || []), item.str.trim()]);
      });
      const embeddedText = [...textLines.entries()]
        .sort(([firstY], [secondY]) => secondY - firstY)
        .map(([, line]) => line.join(' '))
        .join('\n')
        .trim();

      if (embeddedText.length >= 30) {
        pages.push(embeddedText);
        continue;
      }

      if (!worker) {
        worker = await createOcrWorker((progress) => {
          const pageProgress = Math.round(
            (((pageNumber - 1) + (progress.progress / 100)) / pageCount) * 100
          );
          onProgress?.({ ...progress, progress: pageProgress });
        });
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 2600 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PDF पृष्ठ पढ़ने के लिए canvas उपलब्ध नहीं है');

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      pages.push(result.data.text || '');
      canvas.width = 0;
      canvas.height = 0;
    }

    return {
      text: pages.join('\n'),
      truncated: pdf.numPages > MAX_PDF_PAGES,
      pageLimit: MAX_PDF_PAGES,
    };
  } finally {
    if (worker) await worker.terminate();
    await pdf.destroy();
  }
};

export async function readInvitationText(file, onProgress) {
  if (file.type === 'application/pdf') {
    return extractPdfText(file, onProgress);
  }

  return {
    text: await recognizeImage(file, onProgress),
    truncated: false,
    pageLimit: MAX_PDF_PAGES,
  };
}

const normalizeDigits = (value) => value.replace(/[०-९]/g, (digit) =>
  String(digit.charCodeAt(0) - '०'.charCodeAt(0))
);

const MONTHS = {
  jan: 1, january: 1, जनवरी: 1,
  feb: 2, february: 2, फरवरी: 2, फ़रवरी: 2,
  mar: 3, march: 3, मार्च: 3,
  apr: 4, april: 4, अप्रैल: 4,
  may: 5, मई: 5,
  jun: 6, june: 6, जून: 6,
  jul: 7, july: 7, जुलाई: 7,
  aug: 8, august: 8, अगस्त: 8,
  sep: 9, september: 9, सितंबर: 9, सितम्बर: 9,
  oct: 10, october: 10, अक्टूबर: 10,
  nov: 11, november: 11, नवंबर: 11, नवम्बर: 11,
  dec: 12, december: 12, दिसंबर: 12, दिसम्बर: 12,
};

const findDateCandidates = (value) => value.match(
  /\b(?:\d{1,4}[/.\\-]\d{1,2}[/.\\-]\d{2,4}|\d{1,2}\s+(?:[a-zA-Z]+|[\u0900-\u097f]+)\.?,?\s+\d{4})\b/gi
) || [];

const extractLabeledValue = (text, labelPattern) => {
  const line = text.split(/\r?\n/).find((item) => {
    const match = item.match(new RegExp(`^\\s*(?:${labelPattern})(?=\\s|[:：=\\-]|$)`, 'i'));
    return Boolean(match);
  });
  if (!line) return '';

  const match = line.match(new RegExp(
    `^\\s*(?:${labelPattern})(?=\\s|[:：=\\-]|$)(?:\\s*[:：=\\-]\\s*|\\s+)(.+?)\\s*$`,
    'i'
  ));
  return match?.[1]?.replace(/\s{2,}/g, ' ').trim() || '';
};

const extractInlineLabeledValue = (text, labelPattern) => {
  const pattern = new RegExp(
    `(?:^|[\\s,])(?:${labelPattern})(?=\\s|[:：=\\-]|$)(?:\\s*[:：=\\-]\\s*|\\s+)(.+?)\\s*$`,
    'i'
  );
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match) return match[1].replace(/\s{2,}/g, ' ').trim();
  }
  return '';
};

const normalizeForMatching = (value) => value
  .normalize('NFC')
  .replace(/\u093c/g, '')
  .toLocaleLowerCase();

const cleanFieldValue = (value) => value
  .replace(/^[\s:：=—–-]+|[\s,;।|]+$/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const parseDate = (value) => {
  const normalized = normalizeDigits(value);
  let year;
  let month;
  let day;
  const numericDate = normalized.match(/\b(\d{1,4})[/.\\-](\d{1,2})[/.\\-](\d{2,4})\b/);
  if (numericDate) {
    if (numericDate[1].length === 4) {
      [, year, month, day] = numericDate;
    } else {
      [, day, month, year] = numericDate;
    }
  } else {
    const namedMonthDate = normalized.match(
      /\b(\d{1,2})\s+([a-zA-Z]+|[\u0900-\u097f]+)\.?,?\s+(\d{4})\b/i
    );
    if (!namedMonthDate) return '';
    const monthName = namedMonthDate[2].toLocaleLowerCase().replace(/\.$/, '');
    month = MONTHS[monthName];
    if (!month) return '';
    [, day, , year] = namedMonthDate;
  }
  if (year.length === 2) year = `20${year}`;

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (
    yearNumber < 1900
    || yearNumber > 2100
    || date.getUTCFullYear() !== yearNumber
    || date.getUTCMonth() !== monthNumber - 1
    || date.getUTCDate() !== dayNumber
  ) {
    return '';
  }

  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
};

const parseTime = (value) => {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  if (!match) return '';

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > 23) return '';
  if (match[3]) {
    if (hour < 1 || hour > 12) return '';
    hour = (hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const findProgramType = (text, programTypes) => {
  const normalizedText = normalizeForMatching(text);
  return programTypes
    .map((type) => ({
      type,
      name: String(type.programtyp || type.Programtyp || type.name || '').trim(),
    }))
    .filter(({ name }) => name && normalizedText.includes(normalizeForMatching(name)))
    .sort((first, second) => second.name.length - first.name.length)[0];
};

const extractDeceasedName = (text) => {
  const flatText = text.replace(/\s+/g, ' ');
  const match = flatText.match(
    /((?:श्री|श्रीमती|श्रीमानू?|सुश्री)\s*[\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+){0,4}(?:\s*\([^)]*\))?)\s*(?:\([^)]*\)\s*)*का\s+स्वर्गवास/u
  );
  return cleanFieldValue(match?.[1] || '');
};

const extractFamilyRelation = (text) => {
  const match = text.match(
    /(?:के|की|का)\s+((?:छोटे|बड़े|बड़े|ज्येष्ठ|कनिष्ठ)\s+(?:भाई|बहन|पुत्र|पुत्री|बेटे|बेटी|पिताजी|पिता|माताजी|माता))/u
  );
  return cleanFieldValue(match?.[1] || '');
};

const extractSenderFromRelationship = (text, relation) => {
  if (!relation) return '';
  const relationIndex = text.indexOf(relation);
  const precedingText = text.slice(0, relationIndex);
  const match = precedingText.match(/(?:सूचित[^,।]*[,।]\s*)?कि\s*([^,।\n]+)\s*,/u);
  return cleanFieldValue(match?.[1] || '');
};

export function suggestInvitationFields(text, programTypes = []) {
  const normalizedText = normalizeDigits(text);
  const suggestions = {};
  const lines = normalizedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const flatText = lines.join(' ');

  const senderName = extractLabeledValue(
    normalizedText,
    'sender(?:\\s+name)?|inviter(?:\\s+name)?|(?:host|organizer)(?:\\s+name)?|प्रेषक(?:\\s+का)?\\s+नाम|आमंत्रक(?:\\s+का)?\\s+नाम|सादर\\s+आमंत्रक|निवेदक|निमंत्रक|आमंत्रक'
  );
  const familyRelation = extractFamilyRelation(flatText);
  const inferredSender = extractSenderFromRelationship(flatText, familyRelation);
  if (senderName || inferredSender) suggestions.SenderName = senderName || inferredSender;
  if (familyRelation) suggestions.Relation_to_sender = familyRelation;

  const phoneNumbers = normalizedText.match(/(?:^|\D)[6-9]\d{9}(?=\D|$)/g) || [];
  const mobile = phoneNumbers[0]?.replace(/\D/g, '');
  if (mobile) suggestions.Mob = mobile;

  const matchingType = findProgramType(normalizedText, programTypes);
  if (matchingType?.type?.id != null) {
    suggestions.programtyp = String(matchingType.type.id);
  }

  const typeName = matchingType?.name;
  const programLines = typeName
    ? lines.filter((line) => normalizeForMatching(line).includes(normalizeForMatching(typeName)))
    : [];
  const dateLabel = extractLabeledValue(
    normalizedText,
    'event\\s+date|program\\s+date|date|दिनांक|तारीख|कार्यक्रम\\s+की?\\s*तारीख|शुभ\\s+विवाह'
  );
  const dateOnProgramLine = programLines
    .flatMap((line) => findDateCandidates(line))
    .map(parseDate)
    .filter(Boolean);
  const uniqueProgramDates = [...new Set(dateOnProgramLine)];
  const allDateCandidates = findDateCandidates(normalizedText).map(parseDate).filter(Boolean);
  const uniqueDates = [...new Set(allDateCandidates)];
  const eventDate = uniqueProgramDates.length === 1
    ? uniqueProgramDates[0]
    : dateLabel
      ? parseDate(dateLabel)
      : uniqueDates.length === 1
        ? uniqueDates[0]
        : '';
  if (eventDate) suggestions.Date = eventDate;

  const village = extractInlineLabeledValue(
    normalizedText,
    'village|city|ग्राम|गाँव|गांव|शहर'
  );
  if (village) suggestions.Village = cleanFieldValue(village);

  const districtMatch = flatText.match(/(?:district|जिला)\s*[-:=：]?\s*([^,;।|()]+)/iu);
  const district = districtMatch?.[1] || extractInlineLabeledValue(normalizedText, 'district|जिला');
  if (district) suggestions.District = cleanFieldValue(district);

  const programFor = extractLabeledValue(
    normalizedText,
    'program\\s+for|for\\s+whom|कार्यक्रम\\s+किसके\\s+लिए|किसके\\s+शुभ'
  );
  const inferredProgramFor = extractDeceasedName(flatText);
  if (programFor || inferredProgramFor) {
    suggestions.ProgramFor = cleanFieldValue(programFor || inferredProgramFor);
  }

  const relation = extractLabeledValue(
    normalizedText,
    'relation|relationship|संबंध|रिश्ता'
  );
  if (relation) suggestions.Relation_to_sender = cleanFieldValue(relation);

  const placeTime = extractInlineLabeledValue(
    normalizedText,
    'venue|place|location|स्थान|कार्यक्रम\\s+स्थल|आयोजन\\s+स्थल'
  );
  const cleanedPlace = placeTime
    ?.replace(/[,،]?\s*(?:district|जिला)\s*[-:=：]?.*$/iu, '')
    .replace(/[,،]?\s*(?:म\.?\s*प्र\.?|मध्य\s+प्रदेश)\s*$/iu, '');
  if (cleanedPlace) suggestions.place_time = cleanFieldValue(cleanedPlace);

  const timeValue = extractInlineLabeledValue(normalizedText, 'time|समय');
  const eventLineTimes = programLines
    .flatMap((line) => line.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/gi) || []);
  const allTimes = normalizedText.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/gi) || [];
  const eventTime = parseTime(
    timeValue
    || (eventLineTimes.length === 1 ? eventLineTimes[0] : '')
    || (allTimes.length === 1 ? allTimes[0] : '')
  );
  if (eventTime) suggestions.event_time = eventTime;

  return suggestions;
}
