import { ICycleRecord } from '../models/CycleRecord';
import { logger } from '../utils/logger';

const LSTM_SERVICE_URL = process.env.LSTM_SERVICE_URL || 'http://localhost:8000/predict';

export interface ILstmInputCycle {
  cycle_length: number;
  period_duration: number;
  avg_mood_score: number;
  avg_energy_score: number;
}

/**
 * Communicates with the Python LSTM microservice to fetch a personalized cycle length prediction.
 * Returns the predicted next cycle length in days, or null if the service is unreachable/errors.
 */
export const getLstmPrediction = async (
  userId: string,
  cycles: ICycleRecord[]
): Promise<number | null> => {
  try {
    // Gather and reverse to chronological order (oldest first)
    const validCycles = cycles.filter(c => c.cycle_length !== undefined && c.cycle_length > 0);
    if (validCycles.length < 3) {
      return null; // Minimum 3 cycles required for LSTM
    }

    const inputCycles: ILstmInputCycle[] = validCycles
      .map(c => ({
        cycle_length: c.cycle_length || 28,
        period_duration: c.period_duration || 5,
        avg_mood_score: c.avg_mood_score || 3.0,
        avg_energy_score: c.avg_energy_score || 3.0,
      }))
      .reverse();

    // 2-second timeout guard using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const response = await fetch(LSTM_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          cycles: inputCycles,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`LSTM service returned status: ${response.status}`);
        return null;
      }

      const data: any = await response.json();
      const predictedLength = data?.predicted_next_cycle_length;

      if (typeof predictedLength === 'number' && predictedLength > 0) {
        logger.info(`LSTM service predicted cycle length: ${predictedLength} days for user: ${userId}`);
        return predictedLength;
      }

      return null;
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      logger.warn(`LSTM prediction microservice fetch error: ${fetchErr.message}`);
      return null;
    }
  } catch (error: any) {
    logger.warn(`LSTM prediction compilation error: ${error.message}`);
    return null;
  }
};
