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
      text: 'Expired',
      color: '#EF4444',
      isUrgent: true,
    };
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return {
      text: `${diffMinutes}m left`,
      color: '#EF4444',
      isUrgent: true,
    };
  }

  if (diffHours < 24) {
    return {
      text: `${diffHours}h left`,
      color: '#F59E0B',
      isUrgent: true,
    };
  }

  return {
    text: `${diffDays}d left`,
    color: '#64748B',
    isUrgent: false,
  };
}
