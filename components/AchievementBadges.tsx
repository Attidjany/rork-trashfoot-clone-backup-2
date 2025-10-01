import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trophy, Award } from 'lucide-react-native';

interface AchievementBadgesProps {
  leaguesWon: number;
  knockoutsWon: number;
  size?: 'small' | 'medium' | 'large';
  style?: any;
  showLabels?: boolean;
}

export function AchievementBadges({ 
  leaguesWon, 
  knockoutsWon, 
  size = 'medium',
  style,
  showLabels = false
}: AchievementBadgesProps) {
  if (leaguesWon === 0 && knockoutsWon === 0) {
    return null;
  }

  const sizeStyles = {
    small: {
      container: styles.smallContainer,
      badge: styles.smallBadge,
      icon: 12,
      text: styles.smallText,
    },
    medium: {
      container: styles.mediumContainer,
      badge: styles.mediumBadge,
      icon: 14,
      text: styles.mediumText,
    },
    large: {
      container: styles.largeContainer,
      badge: styles.largeBadge,
      icon: 16,
      text: styles.largeText,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={[currentSize.container, style]}>
      {leaguesWon > 0 && (
        <View style={[styles.badge, styles.leagueBadge, currentSize.badge]}>
          <Trophy size={currentSize.icon} color="#FFD700" />
          <Text style={[styles.badgeText, currentSize.text]}>{leaguesWon}</Text>
          {showLabels && <Text style={[styles.labelText, currentSize.text]}>Leagues</Text>}
        </View>
      )}
      {knockoutsWon > 0 && (
        <View style={[styles.badge, styles.knockoutBadge, currentSize.badge]}>
          <Award size={currentSize.icon} color="#A855F7" />
          <Text style={[styles.badgeText, currentSize.text]}>{knockoutsWon}</Text>
          {showLabels && <Text style={[styles.labelText, currentSize.text]}>Cups</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  smallContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  mediumContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  largeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  smallBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    gap: 2,
  },
  mediumBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  largeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  leagueBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  knockoutBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  badgeText: {
    fontWeight: '700' as const,
    color: '#fff',
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 11,
  },
  largeText: {
    fontSize: 12,
  },
  labelText: {
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 2,
  },
});