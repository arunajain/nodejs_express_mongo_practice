import { AppError } from "../errors/AppError.js";
export function durationToMS(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new AppError("Invalid Duration", 500);
  }
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new AppError(`Unsupported duration unit: ${unit}`, 500);
  }
}
