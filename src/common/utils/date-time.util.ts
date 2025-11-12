export function assertRange(
  start: Date,
  end: Date,
  opts?: { allowEqual?: boolean },
) {
  if (!(start instanceof Date) || isNaN(start.getTime()))
    throw new Error('Invalid start date');
  if (!(end instanceof Date) || isNaN(end.getTime()))
    throw new Error('Invalid end date');

  if (start.getTime() > end.getTime())
    throw new Error('Start date must be before end date');
  if (!opts?.allowEqual && start.getTime() === end.getTime())
    throw new Error('Start and end date cannot be equal');
}
