import User from '../models/User';
import DailyLog from '../models/DailyLog';
import CycleRecord from '../models/CycleRecord';
import CyclePrediction from '../models/CyclePrediction';
import { NotFoundError } from '../utils/appError';
import { logger } from '../utils/logger';

interface IReportSummary {
  avgSleep: number;
  avgExercise: number;
  symptomFrequency: Record<string, number>;
  moodFrequency: Record<string, number>;
  totalDaysLogged: number;
  flowDays: number;
}

/**
 * Formats date to YYYY-MM-DD
 */
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Calculates statistics for the report range
 */
const calculateSummary = (logs: any[]): IReportSummary => {
  let totalSleep = 0;
  let totalExercise = 0;
  const symptomFrequency: Record<string, number> = {};
  const moodFrequency: Record<string, number> = {};
  let flowDays = 0;

  logs.forEach(log => {
    if (log.sleep_hours) totalSleep += log.sleep_hours;
    if (log.exercise_minutes) totalExercise += log.exercise_minutes;
    if (log.flow && log.flow !== 'none') flowDays++;

    if (log.symptoms && Array.isArray(log.symptoms)) {
      log.symptoms.forEach((s: string) => {
        symptomFrequency[s] = (symptomFrequency[s] || 0) + 1;
      });
    }

    if (log.mood && Array.isArray(log.mood)) {
      log.mood.forEach((m: string) => {
        moodFrequency[m] = (moodFrequency[m] || 0) + 1;
      });
    }
  });

  const count = logs.length || 1;

  return {
    avgSleep: parseFloat((totalSleep / count).toFixed(1)),
    avgExercise: parseFloat((totalExercise / count).toFixed(1)),
    symptomFrequency,
    moodFrequency,
    totalDaysLogged: logs.length,
    flowDays,
  };
};

/**
 * Generates beautiful HTML structure for report rendering
 */
const buildHtmlTemplate = (
  user: any,
  logs: any[],
  summary: IReportSummary,
  prediction: any,
  fromStr: string,
  toStr: string
): string => {
  // Build symptom list HTML
  const symptomList = Object.entries(summary.symptomFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([symptom, count]) => `
      <div class="frequency-badge">
        <span class="badge-name">${symptom}</span>
        <span class="badge-count">${count} time${count > 1 ? 's' : ''}</span>
      </div>
    `).join('') || '<p class="muted-text">No symptoms logged in this range.</p>';

  // Build mood list HTML
  const moodList = Object.entries(summary.moodFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => `
      <div class="frequency-badge mood-badge">
        <span class="badge-name">${mood}</span>
        <span class="badge-count">${count} time${count > 1 ? 's' : ''}</span>
      </div>
    `).join('') || '<p class="muted-text">No moods logged in this range.</p>';

  // Build logs table rows
  const tableRows = logs.map(log => {
    const formattedLogDate = formatDate(new Date(log.date));
    const flowText = log.flow && log.flow !== 'none' ? `<span class="flow-pill flow-${log.flow}">${log.flow}</span>` : '<span class="muted-text">-</span>';
    const sleepText = log.sleep_hours ? `${log.sleep_hours} hrs` : '-';
    const exerciseText = log.exercise_minutes ? `${log.exercise_minutes} mins` : '-';
    const moods = log.mood && log.mood.length > 0 ? log.mood.map((m: string) => `<span class="pill-mood">${m}</span>`).join(' ') : '<span class="muted-text">-</span>';
    const symptoms = log.symptoms && log.symptoms.length > 0 ? log.symptoms.map((s: string) => `<span class="pill-symptom">${s}</span>`).join(' ') : '<span class="muted-text">-</span>';
    const notesText = log.notes ? log.notes : '<span class="muted-text">No notes.</span>';

    return `
      <tr>
        <td class="date-col">${formattedLogDate}</td>
        <td>${flowText}</td>
        <td>${moods}</td>
        <td>${symptoms}</td>
        <td>${sleepText}</td>
        <td>${exerciseText}</td>
        <td class="notes-col">${notesText}</td>
      </tr>
    `;
  }).join('');

  const cycleLengthVal = user.onboarding_profile?.avg_cycle_length || 28;
  const periodDurationVal = user.onboarding_profile?.avg_period_duration || 5;
  const predictionPhase = prediction?.cycle_phase_today || 'N/A';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Infano.care Health Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    body {
      font-family: 'Outfit', sans-serif;
      margin: 0;
      padding: 40px;
      color: #2F2C33;
      background-color: #FFFFFF;
      -webkit-print-color-adjust: exact;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #FFF0F3;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo-container h1 {
      color: #FF5E8A;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .logo-container p {
      margin: 4px 0 0 0;
      color: #6C6675;
      font-size: 14px;
    }
    .report-meta {
      text-align: right;
    }
    .report-title {
      font-size: 20px;
      font-weight: 600;
      color: #2F2C33;
      margin: 0;
    }
    .report-date {
      font-size: 14px;
      color: #6C6675;
      margin: 6px 0 0 0;
    }
    
    .profile-card {
      background: #FFF6F8;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .profile-item {
      display: flex;
      flex-direction: column;
    }
    .profile-label {
      font-size: 12px;
      color: #9A94A2;
      text-transform: uppercase;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .profile-value {
      font-size: 16px;
      font-weight: 600;
      color: #2F2C33;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #FF5E8A;
      margin-top: 0;
      margin-bottom: 15px;
      border-left: 4px solid #FF5E8A;
      padding-left: 10px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      border: 1px solid #FFF0F3;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      background: #FFFFFF;
    }
    .stat-val {
      font-size: 24px;
      font-weight: 700;
      color: #FF5E8A;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 13px;
      color: #6C6675;
    }

    .trends-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .trend-box {
      border: 1px solid #FFF0F3;
      border-radius: 12px;
      padding: 20px;
      background: #FFFFFF;
    }
    .frequency-badge {
      display: inline-flex;
      align-items: center;
      background: #FFF0F3;
      border-radius: 8px;
      padding: 6px 12px;
      margin: 4px;
      font-size: 13px;
    }
    .badge-name {
      color: #FF5E8A;
      font-weight: 500;
      margin-right: 8px;
    }
    .badge-count {
      color: #6C6675;
      font-size: 12px;
    }
    .mood-badge {
      background: #F3F0FF;
    }
    .mood-badge .badge-name {
      color: #7047EB;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 13px;
    }
    th {
      background-color: #FFF6F8;
      color: #FF5E8A;
      text-align: left;
      padding: 12px;
      font-weight: 600;
      border-bottom: 2px solid #FFF0F3;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #FFF0F3;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background-color: #FAFAFA;
    }
    .date-col {
      font-weight: 500;
      white-space: nowrap;
    }
    .notes-col {
      color: #6C6675;
      max-width: 250px;
    }
    
    .flow-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .flow-light { background: #FFEBEF; color: #FF7396; }
    .flow-medium { background: #FFD6E0; color: #FF3B6F; }
    .flow-heavy { background: #FFA3BA; color: #D6003B; }
    
    .pill-mood {
      display: inline-block;
      background: #F3F0FF;
      color: #7047EB;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      margin: 1px;
    }
    .pill-symptom {
      display: inline-block;
      background: #FFF0F3;
      color: #FF5E8A;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      margin: 1px;
    }
    .muted-text {
      color: #9A94A2;
      font-style: italic;
    }
    .disclaimer {
      margin-top: 40px;
      border-top: 1px solid #FFF0F3;
      padding-top: 15px;
      font-size: 11px;
      color: #9A94A2;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>

  <div class="header-container">
    <div class="logo-container">
      <h1>Infano.care</h1>
      <p>Your Menstrual & Cycle Wellness Companion</p>
    </div>
    <div class="report-meta">
      <div class="report-title">Doctor-Share Health Report</div>
      <div class="report-date">Period: ${fromStr} to ${toStr}</div>
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-item">
      <span class="profile-label">User Name</span>
      <span class="profile-value">${user.name || 'Infano User'}</span>
    </div>
    <div class="profile-item">
      <span class="profile-label">Phone</span>
      <span class="profile-value">${user.phone}</span>
    </div>
    <div class="profile-item">
      <span class="profile-label">Avg Cycle Length</span>
      <span class="profile-value">${cycleLengthVal} days</span>
    </div>
    <div class="profile-item">
      <span class="profile-label">Avg Period Duration</span>
      <span class="profile-value">${periodDurationVal} days</span>
    </div>
  </div>

  <h2 class="section-title">Range Log Summary</h2>
  <div class="summary-grid">
    <div class="stat-card">
      <div class="stat-val">${summary.totalDaysLogged}</div>
      <div class="stat-label">Days Logged</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${summary.flowDays}</div>
      <div class="stat-label">Bleeding Days</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${summary.avgSleep} hrs</div>
      <div class="stat-label">Avg Daily Sleep</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${summary.avgExercise} min</div>
      <div class="stat-label">Avg Daily Exercise</div>
    </div>
  </div>

  <div class="trends-container">
    <div class="trend-box">
      <h3 class="section-title" style="border:none; padding:0; font-size:16px;">Symptom Frequency</h3>
      <div>${symptomList}</div>
    </div>
    <div class="trend-box">
      <h3 class="section-title" style="border:none; padding:0; font-size:16px;">Mood Trends</h3>
      <div>${moodList}</div>
    </div>
  </div>

  <div style="page-break-before: always;"></div>
  
  <h2 class="section-title">Detailed Logs Table</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Flow</th>
        <th>Moods</th>
        <th>Symptoms</th>
        <th>Sleep</th>
        <th>Exercise</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="disclaimer">
    <strong>Medical Disclaimer:</strong> This health report is compiled based on self-reported tracking logs provided by the user within the Infano.care platform. It is intended for educational and support purposes only and should not be used as a replacement for professional clinical advice, diagnostics, or therapies.
  </div>

</body>
</html>
  `;
};

/**
 * Main Service API: Retrieves data and prints PDF report buffer
 */
export const generatePdfReport = async (userId: string, fromDate: Date, toDate: Date): Promise<Buffer> => {
  const puppeteer = require('puppeteer');
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Query logs in range (inclusive, sorted chronologically)
  const logs = await DailyLog.find({
    user_id: userId,
    date: { $gte: fromDate, $lte: toDate },
  })
    .sort({ date: 1 })
    .exec();

  const prediction = await CyclePrediction.findOne({ user_id: userId });
  const summary = calculateSummary(logs);

  const fromStr = formatDate(fromDate);
  const toStr = formatDate(toDate);

  const html = buildHtmlTemplate(user, logs, summary, prediction, fromStr, toStr);

  logger.info(`Launching Puppeteer to generate report for user=${userId} range=${fromStr} to ${toStr}`);

  // Launch headless browser to print PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    // Print to PDF Buffer in A4 layout
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};
