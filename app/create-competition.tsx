import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Trophy, Users, Calendar } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';
import { useSession } from '@/hooks/use-session';
import { useGameStore } from '@/hooks/use-game-store';
import { LinearGradient } from 'expo-linear-gradient';

export default function CreateCompetitionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { groups } = useRealtimeGroups(user?.id);
  const { activeGroupId } = useGameStore();
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  const createCompetitionMutation = trpc.competitions.create.useMutation();
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'league' | 'tournament' | 'friendly'>('league');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  
  // League options
  const [leagueFormat, setLeagueFormat] = useState<'single' | 'double'>('single');
  
  // Friendly options
  const [friendlyType, setFriendlyType] = useState<'best_of' | 'first_to'>('best_of');
  const [friendlyTarget, setFriendlyTarget] = useState('3');
  
  // Tournament options
  const [tournamentType, setTournamentType] = useState<'knockout'>('knockout');

  if (!activeGroup) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: 16 }}>No active group. Please select a group first.</Text>
        <TouchableOpacity
          style={{ marginTop: 16, backgroundColor: '#0EA5E9', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: '600' as const }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCreate = async () => {
    if (!activeGroup) {
      alert('No active group selected');
      return;
    }

    if (!name.trim()) {
      alert('Please enter a competition name');
      return;
    }
    
    if (type === 'friendly') {
      if (selectedPlayers.length !== 2) {
        alert('Friendly matches require exactly 2 players');
        return;
      }
    } else if (type === 'tournament') {
      if (selectedPlayers.length < 4) {
        alert('Tournaments require at least 4 players');
        return;
      }
      if (selectedPlayers.length > 32) {
        alert('Tournaments support maximum 32 players');
        return;
      }
      const isPowerOf2 = (selectedPlayers.length & (selectedPlayers.length - 1)) === 0;
      if (!isPowerOf2) {
        alert('Tournament requires a power of 2 number of players (4, 8, 16, 32)');
        return;
      }
    } else {
      if (selectedPlayers.length < 2) {
        alert('Please select at least 2 players');
        return;
      }
    }

    try {
      console.log('Creating competition with data:', {
        groupId: activeGroup.id,
        name: name.trim(),
        type,
        participantIds: selectedPlayers,
      });

      const result = await createCompetitionMutation.mutateAsync({
        groupId: activeGroup.id,
        name: name.trim(),
        type,
        participantIds: selectedPlayers,
        leagueFormat: type === 'league' ? leagueFormat : undefined,
        friendlyType: type === 'friendly' ? friendlyType : undefined,
        friendlyTarget: type === 'friendly' ? parseInt(friendlyTarget) || 3 : undefined,
        tournamentType: type === 'tournament' ? tournamentType : undefined,
        knockoutMinPlayers: type === 'tournament' ? 4 : undefined,
      });

      if (result.success) {
        console.log('✅ Competition created successfully:', result.competition);
        alert(`Competition "${result.competition.name}" created successfully!`);
        router.back();
      }
    } catch (error: any) {
      console.error('❌ Error creating competition:', error);
      alert(error?.message || 'Failed to create competition');
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <LinearGradient
          colors={['#0EA5E9', '#8B5CF6']}
          style={styles.headerGradient}
        >
          <Trophy size={32} color="#fff" />
          <Text style={styles.headerTitle}>Create Competition</Text>
        </LinearGradient>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Competition Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Weekend League"
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Competition Type</Text>
          <View style={styles.typeSelector}>
            {(['league', 'tournament', 'friendly'] as const).map(competitionType => (
              <TouchableOpacity
                key={competitionType}
                style={[styles.typeOption, type === competitionType && styles.typeOptionActive]}
                onPress={() => {
                  if (competitionType.trim()) {
                    setType(competitionType);
                  }
                }}
              >
                <Text style={[styles.typeText, type === competitionType && styles.typeTextActive]}>
                  {competitionType.charAt(0).toUpperCase() + competitionType.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Competition-specific options */}
        {type === 'league' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>League Format</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, leagueFormat === 'single' && styles.typeOptionActive]}
                onPress={() => setLeagueFormat('single')}
              >
                <Text style={[styles.typeText, leagueFormat === 'single' && styles.typeTextActive]}>
                  Single Round
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeOption, leagueFormat === 'double' && styles.typeOptionActive]}
                onPress={() => setLeagueFormat('double')}
              >
                <Text style={[styles.typeText, leagueFormat === 'double' && styles.typeTextActive]}>
                  Home & Away
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {type === 'friendly' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Friendly Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeOption, friendlyType === 'best_of' && styles.typeOptionActive]}
                  onPress={() => setFriendlyType('best_of')}
                >
                  <Text style={[styles.typeText, friendlyType === 'best_of' && styles.typeTextActive]}>
                    Best of X
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeOption, friendlyType === 'first_to' && styles.typeOptionActive]}
                  onPress={() => setFriendlyType('first_to')}
                >
                  <Text style={[styles.typeText, friendlyType === 'first_to' && styles.typeTextActive]}>
                    First to X
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {friendlyType === 'best_of' ? 'Number of Matches' : 'Wins Required'}
              </Text>
              <TextInput
                style={styles.input}
                value={friendlyTarget}
                onChangeText={setFriendlyTarget}
                placeholder="3"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          </>
        )}
        
        {type === 'tournament' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tournament Format</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                🏆 Knockout tournament: Single elimination format. Requires 4, 8, 16, or 32 players.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Select Players ({selectedPlayers.length} selected)
            {type === 'friendly' && ' - Need exactly 2'}
            {type === 'tournament' && ' - Need 4, 8, 16, or 32'}
            {type === 'league' && ' - Need at least 2'}
          </Text>
          <View style={styles.playerList}>
            {activeGroup.members && activeGroup.members.length > 0 ? activeGroup.members.map(player => (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.playerOption,
                  selectedPlayers.includes(player.id) && styles.playerOptionActive
                ]}
                onPress={() => togglePlayer(player.id)}
              >
                <View style={styles.playerInfo}>
                  <Users size={16} color={selectedPlayers.includes(player.id) ? '#fff' : '#64748B'} />
                  <Text style={[
                    styles.playerName,
                    selectedPlayers.includes(player.id) && styles.playerNameActive
                  ]}>
                    {player.name}
                  </Text>
                </View>
                <View style={[
                  styles.checkbox,
                  selectedPlayers.includes(player.id) && styles.checkboxActive
                ]}>
                  {selectedPlayers.includes(player.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            )) : (
              <Text style={{ color: '#64748B', textAlign: 'center', padding: 16 }}>No members found in this group</Text>
            )}
          </View>
        </View>

        {selectedPlayers.length >= 2 && (
          <View style={styles.infoBox}>
            <Calendar size={16} color="#0EA5E9" />
            <Text style={styles.infoText}>
              {type === 'league' && leagueFormat === 'single' && 
                `This will create ${(selectedPlayers.length * (selectedPlayers.length - 1)) / 2} matches`}
              {type === 'league' && leagueFormat === 'double' && 
                `This will create ${selectedPlayers.length * (selectedPlayers.length - 1)} matches (home & away)`}
              {type === 'friendly' && selectedPlayers.length === 2 && 
                `This will create ${parseInt(friendlyTarget) || 1} ${friendlyType === 'best_of' ? 'matches' : 'matches (first to ' + (parseInt(friendlyTarget) || 1) + ' wins)'}`}
              {type === 'tournament' && selectedPlayers.length >= 4 && 
                `This will create a ${selectedPlayers.length}-player knockout tournament`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
        >
          <LinearGradient
            colors={['#0EA5E9', '#8B5CF6']}
            style={styles.createButtonGradient}
          >
            <Text style={styles.createButtonText}>Create</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 16,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#fff',
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: '#0EA5E9',
  },
  typeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500' as const,
  },
  typeTextActive: {
    color: '#fff',
  },
  playerList: {
    gap: 8,
  },
  playerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
  },
  playerOptionActive: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerName: {
    fontSize: 16,
    color: '#64748B',
  },
  playerNameActive: {
    color: '#fff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  infoText: {
    fontSize: 12,
    color: '#0EA5E9',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500' as const,
  },
  createButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
});