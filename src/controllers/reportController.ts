import { Request, Response, NextFunction } from 'express';
import { generatePdfReport } from '../services/reportService';
import { ValidationError } from '../utils/appError';

/**
 * @desc    Generate and download the user's PDF health report
 * @route   GET /api/v1/health/report/download
 * @access  Private
 */
export const downloadReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const { from, to } = req.query as { from: string; to: string };

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return next(new ValidationError('Invalid date range parameters'));
    }

    if (fromDate > toDate) {
      return next(new ValidationError('From date must be before or equal to To date'));
    }

    const pdfBuffer = await generatePdfReport(userId, fromDate, toDate);

    // Set headers to trigger PDF download stream
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=infano_health_report_${from}_to_${to}.pdf`
    );
    
    res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
};
