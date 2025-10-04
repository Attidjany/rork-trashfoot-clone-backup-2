export interface Player {
  id: string;
  name: string;
  gamerHandle: string;
  email?: string;
  phone?: string;
  avatar?: string;
  joinedAt: string;
  stats: PlayerStats;
  role?: 'player' | 'admin' | 'super_admin';
  status?: 'active' | 'suspended' | 'banned';
  suspendedUntil?: string;
}

export interface PlayerStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  points: number;
  winRate: number;
  form: ('W' | 'D' | 'L')[];
  leaguesWon: number;
  knockoutsWon: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  adminId: string;
  adminIds: string[]; // Multiple admins support
  members: Player[];
  createdAt: string;
  coverImage?: string;
  competitions: Competition[];
  inviteCode: string;
  isPublic?: boolean;
  pendingMembers?: PendingMember[];
}

export interface PendingMember {
  id: string;
  playerId: string;
  playerName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Competition {
  id: string;
  groupId: string;
  name: string;
  type: 'league' | 'tournament' | 'friendly';
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate?: string;
  participants: string[];
  matches: Match[];
  tournamentType?: 'knockout' | 'group_stage' | 'mixed';
  maxParticipants?: number;
  minParticipants?: number;
  rounds?: TournamentRound[];
  bracket?: KnockoutBracket;
  deadlineDays?: number;
  // League specific
  leagueFormat?: 'single' | 'double'; // single = one match per pair, double = home/away
  // Friendly specific
  friendlyType?: 'best_of' | 'first_to'; // best_of = play X matches, first_to = first to X wins
  friendlyTarget?: number; // number of matches or wins
  // Tournament specific
  knockoutMinPlayers?: number;
  // Team restrictions
  teamRestrictions?: {
    type: 'stars' | 'country' | 'all';
    maxStars?: number;
    minStars?: number;
    allowedCountries?: string[];
  };
  badge?: string; // Competition badge/icon
}

export interface TournamentRound {
  id: string;
  name: string;
  roundNumber: number;
  matches: string[];
  status: 'upcoming' | 'active' | 'completed';
  isGenerated: boolean;
}

export interface KnockoutBracket {
  id: string;
  competitionId: string;
  totalRounds: number;
  currentRound: number;
  rounds: TournamentRound[];
  participants: string[];
  winners: { [roundId: string]: string[] };
}

export interface Match {
  id: string;
  competitionId: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'live' | 'completed';
  scheduledTime: string;
  youtubeLink?: string;
  completedAt?: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'text' | 'match_result' | 'youtube_link';
  metadata?: {
    matchId?: string;
    youtubeLink?: string;
  };
}

export interface HeadToHead {
  player1Id: string;
  player2Id: string;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  totalGoals: number;
  matches: Match[];
}

export interface PlatformStats {
  totalUsers: number;
  totalGroups: number;
  totalMatches: number;
  totalCompetitions: number;
  activeGroups: number;
  completedMatches: number;
  liveMatches: number;
  scheduledMatches: number;
}

export interface AdminData {
  allGroups: Group[];
  allUsers: Player[];
  platformStats: PlatformStats;
  recentActivity: {
    type: 'match_completed' | 'group_created' | 'user_joined' | 'competition_started';
    description: string;
    timestamp: string;
    groupId?: string;
    userId?: string;
  }[];
}