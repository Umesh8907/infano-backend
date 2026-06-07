import { IUser } from '../models/User';
import { ICycleRecord } from '../models/CycleRecord';
import { ICyclePrediction } from '../models/CyclePrediction';
import CyclePrediction from '../models/CyclePrediction';
import CycleRecord from '../models/CycleRecord';
import { logger } from '../utils/logger';
import { getLstmPrediction } from './lstmService';

export interface IPredictionOutput {
  next_period_start: Date;
  next_period_start_confidence_days: number;
  next_period_end_estimate: Date;
  ovulation_estimate: Date;
  fertile_window_start: Date;
  fertile_window_end: Date;
  cycle_phase_today: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
  cycle_day_today: number;
  predicted_cycle_length: number;
  cycle_health_score: number;
}

/**
 * Calculates cycle predictions for a user based on Bayesian probabilistic updates.
 */
export const calculateBayesianPrediction = (
  user: IUser,
  cycles: ICycleRecord[],
  currentDate: Date = new Date(),
  forcedCycleLength?: number
): IPredictionOutput => {
  // 1. Prior definitions (from onboarding or defaults)
  const priorMean = user.onboarding_profile?.avg_cycle_length || 28;
  const hasPCOS = user.onboarding_profile?.health_conditions?.includes('PCOS') || false;
  
  // Prior standard deviation (variance represents uncertainty)
  // Higher standard deviation (lower confidence) if user has PCOS or irregular history
  const priorStdDev = hasPCOS ? 8.0 : 4.5;
  const priorVariance = Math.pow(priorStdDev, 2);

  // Population variance (representing the expected variance of a user's cycle lengths around their personal mean)
  const populationVariance = Math.pow(4.0, 2); // σ² ≈ 16

  const n = cycles.filter(c => c.cycle_length !== undefined).length;
  
  let posteriorMean = priorMean;
  let posteriorVariance = priorVariance;

  if (n > 0) {
    const validCycles = cycles.filter(c => c.cycle_length !== undefined && c.cycle_length > 0);
    const sumLengths = validCycles.reduce((acc, c) => acc + (c.cycle_length || 28), 0);
    const sampleMean = validCycles.length > 0 ? sumLengths / validCycles.length : priorMean;
    
    // Bayesian Conjugate Normal Update formula for posterior mean and variance
    // posteriorMean = (σ² * μ₀ + n * σ₀² * x̄) / (σ² + n * σ₀²)
    // 1/posteriorVariance = 1/priorVariance + n/populationVariance
    const num = (populationVariance * priorMean) + (validCycles.length * priorVariance * sampleMean);
    const den = populationVariance + (validCycles.length * priorVariance);
    
    posteriorMean = num / den;
    posteriorVariance = 1 / ((1 / priorVariance) + (validCycles.length / populationVariance));
  }

  const posteriorStdDev = Math.sqrt(posteriorVariance);
  let predictedCycleLength = Math.round(posteriorMean);

  if (forcedCycleLength !== undefined) {
    predictedCycleLength = forcedCycleLength;
  }

  // 2. Identify the anchor date (the start of the most recent cycle)
  let lastPeriodStart: Date;
  
  if (cycles.length > 0) {
    lastPeriodStart = new Date(cycles[0].period_start_date);
  } else if (user.onboarding_profile?.last_period_date) {
    lastPeriodStart = new Date(user.onboarding_profile.last_period_date);
  } else {
    // Fallback if no last period is set
    lastPeriodStart = new Date(currentDate);
    lastPeriodStart.setDate(lastPeriodStart.getDate() - 14); // Assume day 14 of cycle
  }

  // Normalize anchor to midnight UTC/local
  lastPeriodStart.setUTCHours(0, 0, 0, 0);

  // 3. Compute predicted dates
  const nextPeriodStart = new Date(lastPeriodStart);
  nextPeriodStart.setDate(nextPeriodStart.getDate() + predictedCycleLength);

  // Confidence Interval (95% confidence bounds, scaled for usability: capped between 2 and 7 days)
  const confidenceDays = Math.max(2, Math.min(7, Math.round(1.96 * posteriorStdDev)));

  const avgPeriodDuration = user.onboarding_profile?.avg_period_duration || 5;
  const nextPeriodEndEstimate = new Date(nextPeriodStart);
  nextPeriodEndEstimate.setDate(nextPeriodEndEstimate.getDate() + avgPeriodDuration);

  // Ovulation = Next Period Start - 14 days
  const ovulationEstimate = new Date(nextPeriodStart);
  ovulationEstimate.setDate(ovulationEstimate.getDate() - 14);

  // Fertile Window: Ovulation ± 2 days
  const fertileWindowStart = new Date(ovulationEstimate);
  fertileWindowStart.setDate(fertileWindowStart.getDate() - 2);

  const fertileWindowEnd = new Date(ovulationEstimate);
  fertileWindowEnd.setDate(fertileWindowEnd.getDate() + 2);

  // 4. Calculate Current Cycle Day & Phase
  const timeDiff = currentDate.getTime() - lastPeriodStart.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // Cycle day is 1-indexed, wrapping if past predicted length
  let cycleDayToday = (daysDiff % predictedCycleLength) + 1;
  if (cycleDayToday <= 0) cycleDayToday = 1;

  // Compute phase based on current day relative to cycle landmarks
  // Landmark day calculations
  const endOfBleeding = avgPeriodDuration; // Day 5
  const ovulationDay = predictedCycleLength - 14; // Day 14

  let cyclePhaseToday: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' = 'follicular';

  if (cycleDayToday <= endOfBleeding) {
    cyclePhaseToday = 'menstrual';
  } else if (cycleDayToday < ovulationDay - 2) {
    cyclePhaseToday = 'follicular';
  } else if (cycleDayToday <= ovulationDay + 2) {
    cyclePhaseToday = 'ovulation';
  } else {
    cyclePhaseToday = 'luteal';
  }

  // 5. Compute Cycle Health Score (0-100)
  let cycleHealthScore = 75; // Default baseline score
  
  if (cycles.length >= 2) {
    const validLengths = cycles
      .filter(c => c.cycle_length !== undefined)
      .map(c => c.cycle_length as number);
      
    if (validLengths.length > 1) {
      const mean = validLengths.reduce((a, b) => a + b, 0) / validLengths.length;
      const variance = validLengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (validLengths.length - 1);
      const stdDev = Math.sqrt(variance);

      // Deduct score based on cycle length standard deviation (regularity)
      // Standard deviation of <= 2 days is excellent (30 pts)
      let regularityPoints = 30;
      if (stdDev > 2 && stdDev <= 4) regularityPoints = 25;
      else if (stdDev > 4 && stdDev <= 7) regularityPoints = 15;
      else if (stdDev > 7) regularityPoints = 5;

      cycleHealthScore = 50 + regularityPoints; // Baseline 50 + regularity
    }
  }

  // Cap cycleHealthScore securely
  cycleHealthScore = Math.max(0, Math.min(100, cycleHealthScore));

  return {
    next_period_start: nextPeriodStart,
    next_period_start_confidence_days: confidenceDays,
    next_period_end_estimate: nextPeriodEndEstimate,
    ovulation_estimate: ovulationEstimate,
    fertile_window_start: fertileWindowStart,
    fertile_window_end: fertileWindowEnd,
    cycle_phase_today: cyclePhaseToday,
    cycle_day_today: cycleDayToday,
    predicted_cycle_length: predictedCycleLength,
    cycle_health_score: cycleHealthScore,
  };
};

/**
 * Re-evaluates predictions for a given user, updates the CyclePrediction collection cache, and returns it.
 */
export const updatePredictionCache = async (
  userId: string,
  user: IUser,
  currentDate: Date = new Date()
): Promise<ICyclePrediction> => {
  // Fetch chronological list of logged cycles (newest first)
  const cycles = await CycleRecord.find({ user_id: userId })
    .sort({ period_start_date: -1 })
    .exec();

  let predOutput = calculateBayesianPrediction(user, cycles, currentDate);
  let modelVersion = 'bayesian_v1';

  const validCycles = cycles.filter(c => c.cycle_length !== undefined && c.cycle_length > 0);
  const n = validCycles.length;

  if (n >= 3) {
    const lstmLength = await getLstmPrediction(userId, cycles);
    if (lstmLength !== null) {
      let alpha = 0.60;
      if (n >= 12) {
        alpha = 0.85;
      } else {
        alpha = 0.60 + ((n - 3) * (0.85 - 0.60)) / 9;
      }
      const bayesianLength = predOutput.predicted_cycle_length;
      const blendedLength = Math.round((1 - alpha) * bayesianLength + alpha * lstmLength);
      
      predOutput = calculateBayesianPrediction(user, cycles, currentDate, blendedLength);
      modelVersion = 'blended_v1';
      logger.info(`Blended prediction model active for user ${userId}: alpha=${alpha}, final_length=${blendedLength}`);
    }
  }

  const expiresAt = new Date(currentDate);
  expiresAt.setUTCHours(23, 59, 59, 999); // Recalculate daily or on new logs

  const prediction = await CyclePrediction.findOneAndUpdate(
    { user_id: userId },
    {
      user_id: userId,
      generated_at: new Date(),
      model_version: modelVersion,
      cycles_logged: cycles.length,
      next_period_start: predOutput.next_period_start,
      next_period_start_confidence_days: predOutput.next_period_start_confidence_days,
      next_period_end_estimate: predOutput.next_period_end_estimate,
      ovulation_estimate: predOutput.ovulation_estimate,
      fertile_window_start: predOutput.fertile_window_start,
      fertile_window_end: predOutput.fertile_window_end,
      cycle_phase_today: predOutput.cycle_phase_today,
      cycle_day_today: predOutput.cycle_day_today,
      predicted_cycle_length: predOutput.predicted_cycle_length,
      cycle_health_score: predOutput.cycle_health_score,
      expires_at: expiresAt,
    },
    { upsert: true, new: true }
  ).exec();

  logger.info(`Updated cycle prediction cache for user: ${userId}. Next period: ${predOutput.next_period_start.toISOString()}`);
  return prediction;
};
