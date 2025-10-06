import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, Trophy, Youtube, Play, Target, Clock, Award } from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { useSession } from '@/hooks/use-session';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { loading: sessionLoading } = useSession();
  const { groups, isLoading: groupsLoading } = useRealtimeGroups();
  const { activeGroupId, messages, sendMessage, currentUser } = useGameStore();
  
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;
  const isLoading = sessionLoading || groupsLoading;
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  if (isLoading) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!activeGroup) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>No Active Group</Text>
        <Text style={styles.emptyText}>Join or create a group to start chatting</Text>
      </View>
    );
  }

  const handleSend = () => {
    if (inputText.trim()) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  };

  const renderMessage = (message: typeof messages[0]) => {
    const isOwnMessage = message.senderId === currentUser?.id;
    const isSystemMessage = message.senderName === 'System';
    const isEventMessage = ['match_live', 'match_score', 'competition_created', 'competition_deadline', 'competition_finished'].includes(message.type);
    
    const getEventIcon = () => {
      switch (message.type) {
        case 'match_live':
          return <Play size={18} color="#EF4444" />;
        case 'match_score':
          return <Trophy size={18} color="#10B981" />;
        case 'competition_created':
          return <Target size={18} color="#3B82F6" />;
        case 'competition_deadline':
          return <Clock size={18} color="#F59E0B" />;
        case 'competition_finished':
          return <Award size={18} color="#8B5CF6" />;
        case 'match_result':
          return <Trophy size={16} color="#0EA5E9" />;
        case 'youtube_link':
          return <Youtube size={16} color="#FF0000" />;
        default:
          return null;
      }
    };

    const getEventColor = () => {
      switch (message.type) {
        case 'match_live':
          return '#EF4444';
        case 'match_score':
          return '#10B981';
        case 'competition_created':
          return '#3B82F6';
        case 'competition_deadline':
          return '#F59E0B';
        case 'competition_finished':
          return '#8B5CF6';
        default:
          return '#0EA5E9';
      }
    };

    const renderEventDetails = () => {
      if (!message.metadata) return null;

      switch (message.type) {
        case 'match_score':
          const homeScore = message.metadata.homeScore ?? 0;
          const awayScore = message.metadata.awayScore ?? 0;
          const isDraw = homeScore === awayScore;
          const homeWon = homeScore > awayScore;
          const awayWon = awayScore > homeScore;
          
          return (
            <View style={styles.eventDetails}>
              <View style={styles.scoreContainer}>
                <View style={[styles.scoreTeam, homeWon && styles.scoreTeamWinner]}>
                  <Text style={[styles.scoreTeamName, homeWon && styles.scoreTeamNameWinner]} numberOfLines={1}>
                    {message.metadata.homePlayerName}
                  </Text>
                  <Text style={[styles.scoreValue, homeWon && styles.scoreValueWinner]}>
                    {homeScore}
                  </Text>
                </View>
                <Text style={styles.scoreSeparator}>-</Text>
                <View style={[styles.scoreTeam, awayWon && styles.scoreTeamWinner]}>
                  <Text style={[styles.scoreValue, awayWon && styles.scoreValueWinner]}>
                    {awayScore}
                  </Text>
                  <Text style={[styles.scoreTeamName, awayWon && styles.scoreTeamNameWinner]} numberOfLines={1}>
                    {message.metadata.awayPlayerName}
                  </Text>
                </View>
              </View>
              {!isDraw && message.metadata.winnerName && (
                <View style={styles.winnerBadge}>
                  <Trophy size={12} color="#FCD34D" />
                  <Text style={styles.winnerText}>{message.metadata.winnerName} wins!</Text>
                </View>
              )}
              {isDraw && (
                <View style={styles.drawBadge}>
                  <Text style={styles.drawText}>Draw</Text>
                </View>
              )}
            </View>
          );

        case 'competition_created':
          return (
            <View style={styles.eventDetails}>
              <View style={styles.eventInfoRow}>
                <Text style={styles.eventLabel}>Type:</Text>
                <Text style={styles.eventValue}>{message.metadata.competitionType}</Text>
              </View>
              {message.metadata.matchCount !== undefined && message.metadata.matchCount > 0 && (
                <View style={styles.eventInfoRow}>
                  <Text style={styles.eventLabel}>Matches:</Text>
                  <Text style={styles.eventValue}>{message.metadata.matchCount}</Text>
                </View>
              )}
              {message.metadata.deadlineDays && (
                <View style={styles.eventInfoRow}>
                  <Text style={styles.eventLabel}>Deadline:</Text>
                  <Text style={styles.eventValue}>{message.metadata.deadlineDays} days</Text>
                </View>
              )}
            </View>
          );

        case 'competition_finished':
          return (
            <View style={styles.eventDetails}>
              {message.metadata.winnerName && (
                <View style={styles.championBadge}>
                  <Award size={16} color="#FCD34D" />
                  <Text style={styles.championText}>{message.metadata.winnerName}</Text>
                </View>
              )}
              <View style={styles.eventStatsRow}>
                <View style={styles.eventStat}>
                  <Text style={styles.eventStatValue}>{message.metadata.matchesPlayed || 0}</Text>
                  <Text style={styles.eventStatLabel}>Played</Text>
                </View>
                {message.metadata.matchesDropped !== undefined && message.metadata.matchesDropped > 0 && (
                  <View style={styles.eventStat}>
                    <Text style={styles.eventStatValue}>{message.metadata.matchesDropped}</Text>
                    <Text style={styles.eventStatLabel}>Dropped</Text>
                  </View>
                )}
              </View>
            </View>
          );

        case 'competition_deadline':
          return (
            <View style={styles.eventDetails}>
              <View style={styles.deadlineWarning}>
                <Text style={styles.deadlineText}>
                  {message.metadata.deadlineDays} day{message.metadata.deadlineDays !== 1 ? 's' : ''} remaining
                </Text>
                {message.metadata.matchCount !== undefined && message.metadata.matchCount > 0 && (
                  <Text style={styles.deadlineMatches}>
                    {message.metadata.matchCount} match{message.metadata.matchCount !== 1 ? 'es' : ''} left
                  </Text>
                )}
              </View>
            </View>
          );

        default:
          return null;
      }
    };
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isOwnMessage && !isSystemMessage && styles.ownMessageContainer,
          isSystemMessage && styles.systemMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage && !isSystemMessage && styles.ownMessageBubble,
            isSystemMessage && styles.systemMessageBubble,
            isEventMessage && styles.eventMessageBubble,
            message.type !== 'text' && !isEventMessage && styles.specialMessageBubble,
          ]}
        >
          {!isOwnMessage && !isSystemMessage && (
            <Text style={styles.senderName}>{message.senderName}</Text>
          )}
          
          {isEventMessage && (
            <View style={[styles.eventHeader, { borderLeftColor: getEventColor() }]}>
              <View style={styles.eventIcon}>
                {getEventIcon()}
              </View>
              <Text style={styles.eventTitle}>{message.message}</Text>
            </View>
          )}
          
          {!isEventMessage && message.type === 'match_result' && (
            <View style={styles.matchResultIcon}>
              <Trophy size={16} color="#0EA5E9" />
            </View>
          )}
          
          {!isEventMessage && message.type === 'youtube_link' && (
            <View style={styles.youtubeLinkIcon}>
              <Youtube size={16} color="#FF0000" />
            </View>
          )}
          
          {!isEventMessage && (
            <Text style={[
              styles.messageText,
              isOwnMessage && !isSystemMessage && styles.ownMessageText,
              isSystemMessage && styles.systemMessageText,
            ]}>
              {message.message}
            </Text>
          )}

          {renderEventDetails()}
          
          <Text style={[
            styles.timestamp,
            isOwnMessage && !isSystemMessage && styles.ownTimestamp,
            isSystemMessage && styles.systemTimestamp,
          ]}>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
          </View>
        ) : (
          messages.map(renderMessage)
        )}
      </ScrollView>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#64748B"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Send size={20} color={inputText.trim() ? '#fff' : '#64748B'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChatText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  systemMessageContainer: {
    alignItems: 'center',
  },
  messageBubble: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    maxWidth: '80%',
  },
  ownMessageBubble: {
    backgroundColor: '#0EA5E9',
  },
  systemMessageBubble: {
    backgroundColor: '#1E293B',
    maxWidth: '90%',
  },
  eventMessageBubble: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: '90%',
  },
  specialMessageBubble: {
    borderWidth: 1,
    borderColor: '#334155',
  },
  senderName: {
    fontSize: 12,
    color: '#0EA5E9',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  systemMessageText: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  timestamp: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  systemTimestamp: {
    color: '#475569',
    textAlign: 'center',
  },
  matchResultIcon: {
    marginBottom: 4,
  },
  youtubeLinkIcon: {
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 14,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
  },
  eventIcon: {
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  eventDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreTeamWinner: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 6,
  },
  scoreTeamName: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
  },
  scoreTeamNameWinner: {
    color: '#10B981',
    fontWeight: '600' as const,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  scoreValueWinner: {
    color: '#10B981',
  },
  scoreSeparator: {
    fontSize: 16,
    color: '#64748B',
    marginHorizontal: 8,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(252, 211, 77, 0.1)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 6,
  },
  winnerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FCD34D',
  },
  drawBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  drawText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  eventInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  eventValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  championBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  championText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#A78BFA',
  },
  eventStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  eventStat: {
    alignItems: 'center',
  },
  eventStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  eventStatLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  deadlineWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  deadlineText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  deadlineMatches: {
    fontSize: 11,
    color: '#FBBF24',
    marginTop: 2,
  },
});