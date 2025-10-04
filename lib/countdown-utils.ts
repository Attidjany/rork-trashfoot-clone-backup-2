export function getMatchCountdown(scheduledTime: string): {
  text: string;
  color: string;
  isUrgent: boolean;
} {
  const now = new Date().getTime();
  const matchTime = new Date(scheduledTime).getTime();
  const diffMs = matchTime - now;

  if (diffMs <= 0) {
    return {
      text: 'Now',
      color: '#EF4444',
      isUrgent: true,
    };
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return {
      text: `${diffMinutes}m`,
      color: '#EF4444',
      isUrgent: true,
    };
  }

  if (diffHours < 24) {
    return {
      text: `${diffHours}h`,
      color: '#F59E0B',
      isUrgent: true,
    };
  }

  return {
    text: `${diffDays}d`,
    color: '#64748B',
    isUrgent: false,
  };
}

export function getCompetitionDeadline(
  startDate: string,
  deadlineDays?: number
): Date | null {
  if (!deadlineDays) return null;

  const start = new Date(startDate);
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + deadlineDays);
  deadline.setHours(23, 59, 59, 999);

  return deadline;
}

export function isCompetitionExpired(
  startDate: string,
  deadlineDays?: number
): boolean {
  if (!deadlineDays) return false;

  const deadline = getCompetitionDeadline(startDate, deadlineDays);
  if (!deadline) return false;

  return new Date().getTime() > deadline.getTime();
}
