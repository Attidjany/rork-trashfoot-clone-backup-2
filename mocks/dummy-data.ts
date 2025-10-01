import { Player, Group, Competition, Match, ChatMessage, AdminData, PlatformStats, KnockoutBracket, TournamentRound } from '@/types/game';

function calculatePlayerStats(playerId: string, matches: Match[], competitions: Competition[] = []) {
  const playerMatches = matches.filter(
    m => (m.homePlayerId === playerId || m.awayPlayerId === playerId) && m.status === 'completed'
  );

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  const form: ('W' | 'D' | 'L')[] = [];

  playerMatches.forEach(match => {
    const isHome = match.homePlayerId === playerId;
    const playerScore = isHome ? match.homeScore! : match.awayScore!;
    const opponentScore = isHome ? match.awayScore! : match.homeScore!;

    goalsFor += playerScore;
    goalsAgainst += opponentScore;

    if (opponentScore === 0) cleanSheets++;

    if (playerScore > opponentScore) {
      wins++;
      form.unshift('W');
    } else if (playerScore === opponentScore) {
      draws++;
      form.unshift('D');
    } else {
      losses++;
      form.unshift('L');
    }
  });

  // Calculate league and knockout wins
  let leaguesWon = 0;
  let knockoutsWon = 0;

  competitions.forEach(comp => {
    if (comp.status === 'completed' && comp.participants.includes(playerId)) {
      if (comp.type === 'league') {
        // Check if player won the league (most points)
        const leagueMatches = comp.matches.filter(m => m.status === 'completed');
        const playerPoints = leagueMatches
          .filter(m => m.homePlayerId === playerId || m.awayPlayerId === playerId)
          .reduce((pts, match) => {
            const isHome = match.homePlayerId === playerId;
            const playerScore = isHome ? match.homeScore! : match.awayScore!;
            const opponentScore = isHome ? match.awayScore! : match.homeScore!;
            
            if (playerScore > opponentScore) return pts + 3;
            if (playerScore === opponentScore) return pts + 1;
            return pts;
          }, 0);
        
        // Check if this player has the most points in this league
        const allPlayerPoints = comp.participants.map(participantId => {
          return leagueMatches
            .filter(m => m.homePlayerId === participantId || m.awayPlayerId === participantId)
            .reduce((pts, match) => {
              const isHome = match.homePlayerId === participantId;
              const playerScore = isHome ? match.homeScore! : match.awayScore!;
              const opponentScore = isHome ? match.awayScore! : match.homeScore!;
              
              if (playerScore > opponentScore) return pts + 3;
              if (playerScore === opponentScore) return pts + 1;
              return pts;
            }, 0);
        });
        
        const maxPoints = Math.max(...allPlayerPoints);
        if (playerPoints === maxPoints && playerPoints > 0) {
          leaguesWon++;
        }
      } else if (comp.type === 'tournament' && comp.tournamentType === 'knockout') {
        // Check if player won the knockout tournament (won the final)
        if (comp.bracket && comp.bracket.rounds.length > 0) {
          const finalRound = comp.bracket.rounds[comp.bracket.rounds.length - 1];
          if (finalRound.status === 'completed' && finalRound.matches.length > 0) {
            const finalMatchId = finalRound.matches[0];
            const finalMatch = comp.matches.find(m => m.id === finalMatchId);
            if (finalMatch && finalMatch.status === 'completed') {
              const isHome = finalMatch.homePlayerId === playerId;
              const playerScore = isHome ? finalMatch.homeScore! : finalMatch.awayScore!;
              const opponentScore = isHome ? finalMatch.awayScore! : finalMatch.homeScore!;
              
              if (playerScore > opponentScore) {
                knockoutsWon++;
              }
            }
          }
        }
      }
    }
  });

  const played = wins + draws + losses;
  const points = wins * 3 + draws;
  const winRate = played > 0 ? (wins / played) * 100 : 0;

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    points,
    winRate,
    form: form.slice(0, 5),
    leaguesWon,
    knockoutsWon,
  };
}

export function createDummyData() {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

  // Create players with realistic TrashFoot names
  const players: Player[] = [
    {
      id: 'player1',
      name: 'Alex "Striker" Johnson',
      gamerHandle: 'striker_alex',
      email: 'alex@trashfoot.com',
      role: 'admin',
      status: 'active',
      joinedAt: threeWeeksAgo.toISOString(),
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        points: 0,
        winRate: 0,
        form: [],
        leaguesWon: 0,
        knockoutsWon: 0,
      },
    },
    {
      id: 'player2',
      name: 'Marcus "The Wall" Rodriguez',
      gamerHandle: 'the_wall_marcus',
      email: 'marcus@trashfoot.com',
      role: 'player',
      status: 'active',
      joinedAt: threeWeeksAgo.toISOString(),
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        points: 0,
        winRate: 0,
        form: [],
        leaguesWon: 0,
        knockoutsWon: 0,
      },
    },
    {
      id: 'player3',
      name: 'Jamie "Speed" Chen',
      gamerHandle: 'speed_jamie',
      email: 'jamie@trashfoot.com',
      role: 'player',
      status: 'active',
      joinedAt: twoWeeksAgo.toISOString(),
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        points: 0,
        winRate: 0,
        form: [],
        leaguesWon: 0,
        knockoutsWon: 0,
      },
    },
    {
      id: 'player4',
      name: 'David "Maestro" Thompson',
      gamerHandle: 'maestro_david',
      email: 'david@trashfoot.com',
      role: 'player',
      status: 'active',
      joinedAt: twoWeeksAgo.toISOString(),
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        points: 0,
        winRate: 0,
        form: [],
        leaguesWon: 0,
        knockoutsWon: 0,
      },
    },
    {
      id: 'player5',
      name: 'Sarah "Rocket" Williams',
      gamerHandle: 'rocket_sarah',
      email: 'sarah@trashfoot.com',
      role: 'player',
      status: 'active',
      joinedAt: oneWeekAgo.toISOString(),
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        points: 0,
        winRate: 0,
        form: [],
        leaguesWon: 0,
        knockoutsWon: 0,
      },
    },
    {
      id: 'player6',
      name: 'Mike "Clutch" Anderson',
      gamerHandle: 'clutch_mike',
      email: 'mike@trashfoot.com',
      role: 'player',
      status: 'active',
      joinedAt: oneWeekAgo.toISOString(),
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        points: 0,
        winRate: 0,
        form: [],
        leaguesWon: 0,
        knockoutsWon: 0,
      },
    },
  ];

  // Create knockout tournament matches first
  const knockoutMatches: Match[] = [
    // First round
    {
      id: 'knockout1',
      competitionId: 'comp2',
      homePlayerId: 'player1',
      awayPlayerId: 'player2',
      homeScore: 2,
      awayScore: 1,
      status: 'completed',
      scheduledTime: new Date(twoWeeksAgo.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(twoWeeksAgo.getTime() + 1.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'knockout2',
      competitionId: 'comp2',
      homePlayerId: 'player3',
      awayPlayerId: 'player4',
      homeScore: 3,
      awayScore: 0,
      status: 'completed',
      scheduledTime: new Date(twoWeeksAgo.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(twoWeeksAgo.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
    },
    // Final - Alex wins
    {
      id: 'knockout3',
      competitionId: 'comp2',
      homePlayerId: 'player1',
      awayPlayerId: 'player3',
      homeScore: 3,
      awayScore: 1,
      status: 'completed',
      scheduledTime: new Date(oneWeekAgo.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(oneWeekAgo.getTime() + 1.5 * 60 * 60 * 1000).toISOString(),
    },
  ];

  // Create matches with realistic scores
  const matches: Match[] = [
    // Week 1 matches
    {
      id: 'match1',
      competitionId: 'comp1',
      homePlayerId: 'player1',
      awayPlayerId: 'player2',
      homeScore: 3,
      awayScore: 1,
      status: 'completed',
      scheduledTime: new Date(threeWeeksAgo.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(threeWeeksAgo.getTime() + 1.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match2',
      competitionId: 'comp1',
      homePlayerId: 'player3',
      awayPlayerId: 'player4',
      homeScore: 2,
      awayScore: 2,
      status: 'completed',
      scheduledTime: new Date(threeWeeksAgo.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(threeWeeksAgo.getTime() + 3.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match3',
      competitionId: 'comp1',
      homePlayerId: 'player5',
      awayPlayerId: 'player6',
      homeScore: 1,
      awayScore: 4,
      status: 'completed',
      scheduledTime: new Date(threeWeeksAgo.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(threeWeeksAgo.getTime() + 5.5 * 60 * 60 * 1000).toISOString(),
    },
    // Week 2 matches
    {
      id: 'match4',
      competitionId: 'comp1',
      homePlayerId: 'player1',
      awayPlayerId: 'player3',
      homeScore: 2,
      awayScore: 0,
      status: 'completed',
      scheduledTime: new Date(twoWeeksAgo.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(twoWeeksAgo.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match5',
      competitionId: 'comp1',
      homePlayerId: 'player2',
      awayPlayerId: 'player6',
      homeScore: 3,
      awayScore: 2,
      status: 'completed',
      scheduledTime: new Date(twoWeeksAgo.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(twoWeeksAgo.getTime() + 4.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match6',
      competitionId: 'comp1',
      homePlayerId: 'player4',
      awayPlayerId: 'player5',
      homeScore: 1,
      awayScore: 1,
      status: 'completed',
      scheduledTime: new Date(twoWeeksAgo.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(twoWeeksAgo.getTime() + 6.5 * 60 * 60 * 1000).toISOString(),
    },
    // Week 3 matches
    {
      id: 'match7',
      competitionId: 'comp1',
      homePlayerId: 'player1',
      awayPlayerId: 'player4',
      homeScore: 4,
      awayScore: 2,
      status: 'completed',
      scheduledTime: new Date(oneWeekAgo.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(oneWeekAgo.getTime() + 1.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match8',
      competitionId: 'comp1',
      homePlayerId: 'player2',
      awayPlayerId: 'player5',
      homeScore: 0,
      awayScore: 3,
      status: 'completed',
      scheduledTime: new Date(oneWeekAgo.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(oneWeekAgo.getTime() + 3.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match9',
      competitionId: 'comp1',
      homePlayerId: 'player3',
      awayPlayerId: 'player6',
      homeScore: 2,
      awayScore: 1,
      status: 'completed',
      scheduledTime: new Date(oneWeekAgo.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(oneWeekAgo.getTime() + 5.5 * 60 * 60 * 1000).toISOString(),
    },
    // Upcoming matches
    {
      id: 'match10',
      competitionId: 'comp1',
      homePlayerId: 'player1',
      awayPlayerId: 'player5',
      status: 'scheduled',
      scheduledTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match11',
      competitionId: 'comp1',
      homePlayerId: 'player2',
      awayPlayerId: 'player3',
      status: 'scheduled',
      scheduledTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'match12',
      competitionId: 'comp1',
      homePlayerId: 'player4',
      awayPlayerId: 'player6',
      status: 'live',
      scheduledTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      youtubeLink: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    },
  ];

  // Create competitions first
  const competitions: Competition[] = [
    {
      id: 'comp1',
      groupId: 'group1',
      name: 'TrashFoot Champions League 2024',
      type: 'league',
      status: 'completed', // Mark as completed so Alex wins it
      startDate: threeWeeksAgo.toISOString(),
      participants: players.map(p => p.id),
      matches,
    },
    {
      id: 'comp2',
      groupId: 'group1',
      name: 'Weekend Cup',
      type: 'tournament',
      tournamentType: 'knockout',
      status: 'completed', // Mark as completed so Alex wins it
      startDate: new Date(twoWeeksAgo.getTime()).toISOString(),
      participants: ['player1', 'player2', 'player3', 'player4'],
      matches: knockoutMatches,
      bracket: {
        id: 'bracket1',
        competitionId: 'comp2',
        totalRounds: 2,
        currentRound: 1,
        participants: ['player1', 'player2', 'player3', 'player4'],
        rounds: [
          {
            id: 'round1',
            name: 'Semi-Final',
            roundNumber: 0,
            matches: ['knockout1', 'knockout2'],
            status: 'completed',
            isGenerated: true,
          },
          {
            id: 'round2',
            name: 'Final',
            roundNumber: 1,
            matches: ['knockout3'],
            status: 'completed',
            isGenerated: true,
          },
        ],
        winners: {
          'round1': ['player1', 'player3'],
        },
      },
    },
  ];



  // Calculate stats for all players with competitions
  const playersWithStats = players.map(player => ({
    ...player,
    stats: calculatePlayerStats(player.id, [...matches, ...knockoutMatches], competitions),
  }));





  // Create group
  const group: Group = {
    id: 'group1',
    name: 'TrashFoot Legends',
    description: 'Elite TrashFoot players competing for glory! 🏆⚽',
    adminId: 'player1',
    adminIds: ['player1'],
    members: playersWithStats,
    createdAt: threeWeeksAgo.toISOString(),
    competitions,
    inviteCode: 'TRASHLEGS',
    isPublic: true,
    pendingMembers: [],
  };

  // Create chat messages
  const messages: ChatMessage[] = [
    {
      id: 'msg1',
      groupId: 'group1',
      senderId: 'player1',
      senderName: 'Alex "Striker" Johnson',
      message: 'Welcome to TrashFoot Legends! Ready to dominate? 🔥',
      timestamp: threeWeeksAgo.toISOString(),
      type: 'text',
    },
    {
      id: 'msg2',
      groupId: 'group1',
      senderId: 'player2',
      senderName: 'Marcus "The Wall" Rodriguez',
      message: 'Let\'s gooo! Time to show who\'s the real champion 💪',
      timestamp: new Date(threeWeeksAgo.getTime() + 10 * 60 * 1000).toISOString(),
      type: 'text',
    },
    {
      id: 'msg3',
      groupId: 'group1',
      senderId: 'player1',
      senderName: 'Alex "Striker" Johnson',
      message: 'Match Result: Alex "Striker" Johnson 3 - 1 Marcus "The Wall" Rodriguez',
      timestamp: new Date(threeWeeksAgo.getTime() + 1.5 * 60 * 60 * 1000).toISOString(),
      type: 'match_result',
      metadata: { matchId: 'match1' },
    },
    {
      id: 'msg4',
      groupId: 'group1',
      senderId: 'player2',
      senderName: 'Marcus "The Wall" Rodriguez',
      message: 'GG! That was intense. Your finishing was on point 👏',
      timestamp: new Date(threeWeeksAgo.getTime() + 1.6 * 60 * 60 * 1000).toISOString(),
      type: 'text',
    },
    {
      id: 'msg5',
      groupId: 'group1',
      senderId: 'player3',
      senderName: 'Jamie "Speed" Chen',
      message: 'What a match! 2-2 draw with David was crazy 🤯',
      timestamp: new Date(threeWeeksAgo.getTime() + 3.6 * 60 * 60 * 1000).toISOString(),
      type: 'text',
    },
    {
      id: 'msg6',
      groupId: 'group1',
      senderId: 'player6',
      senderName: 'Mike "Clutch" Anderson',
      message: 'Sarah destroyed me 4-1 😅 Those skills are unreal!',
      timestamp: new Date(threeWeeksAgo.getTime() + 5.6 * 60 * 60 * 1000).toISOString(),
      type: 'text',
    },
    {
      id: 'msg7',
      groupId: 'group1',
      senderId: 'player5',
      senderName: 'Sarah "Rocket" Williams',
      message: 'Thanks! Been practicing my dribbling all week 💯',
      timestamp: new Date(threeWeeksAgo.getTime() + 5.7 * 60 * 60 * 1000).toISOString(),
      type: 'text',
    },
    {
      id: 'msg8',
      groupId: 'group1',
      senderId: 'player4',
      senderName: 'David "Maestro" Thompson',
      message: '🔴 Live now: https://youtube.com/watch?v=dQw4w9WgXcQ',
      timestamp: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
      type: 'youtube_link',
      metadata: { matchId: 'match12', youtubeLink: 'https://youtube.com/watch?v=dQw4w9WgXcQ' },
    },
    {
      id: 'msg9',
      groupId: 'group1',
      senderId: 'player1',
      senderName: 'Alex "Striker" Johnson',
      message: 'Watching now! This is going to be epic 🍿',
      timestamp: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      type: 'text',
    },
    {
      id: 'msg10',
      groupId: 'group1',
      senderId: 'player3',
      senderName: 'Jamie "Speed" Chen',
      message: 'Who\'s ready for the Weekend Cup? Tournament mode activated! 🏆',
      timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      type: 'text',
    },
  ];

  return {
    currentUser: playersWithStats[0], // Alex is the current user
    groups: [group],
    activeGroupId: 'group1',
    messages,
  };
}

export function createAdminDummyData(): AdminData {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

  // Create additional groups for admin view
  const additionalGroups: Group[] = [
    {
      id: 'group2',
      name: 'TrashFoot Rising Stars',
      description: 'New players learning the ropes 🌟',
      adminId: 'player7',
      adminIds: ['player7'],
      members: [
        {
          id: 'player7',
          name: 'Emma "Rookie" Davis',
          gamerHandle: 'rookie_emma',
          email: 'emma@trashfoot.com',
          role: 'admin',
          status: 'active',
          joinedAt: oneWeekAgo.toISOString(),
          stats: { played: 5, wins: 2, draws: 1, losses: 2, goalsFor: 8, goalsAgainst: 7, cleanSheets: 1, points: 7, winRate: 40, form: ['W', 'L', 'D', 'W', 'L'], leaguesWon: 0, knockoutsWon: 0 },
        },
        {
          id: 'player8',
          name: 'Ryan "Flash" Miller',
          gamerHandle: 'flash_ryan',
          email: 'ryan@trashfoot.com',
          role: 'player',
          status: 'active',
          joinedAt: oneWeekAgo.toISOString(),
          stats: { played: 4, wins: 3, draws: 0, losses: 1, goalsFor: 12, goalsAgainst: 5, cleanSheets: 2, points: 9, winRate: 75, form: ['W', 'W', 'L', 'W'], leaguesWon: 1, knockoutsWon: 0 },
        },
        {
          id: 'player9',
          name: 'Lisa "Defender" Wilson',
          gamerHandle: 'defender_lisa',
          email: 'lisa@trashfoot.com',
          role: 'player',
          status: 'active',
          joinedAt: twoWeeksAgo.toISOString(),
          stats: { played: 6, wins: 1, draws: 3, losses: 2, goalsFor: 4, goalsAgainst: 8, cleanSheets: 3, points: 6, winRate: 16.7, form: ['D', 'L', 'W', 'D', 'L', 'D'], leaguesWon: 0, knockoutsWon: 0 },
        },
      ],
      createdAt: oneWeekAgo.toISOString(),
      inviteCode: 'ROOKIES1',
      isPublic: true,
      pendingMembers: [],
      competitions: [
        {
          id: 'comp3',
          groupId: 'group2',
          name: 'Rookie League',
          type: 'league',
          status: 'active',
          startDate: oneWeekAgo.toISOString(),
          participants: ['player7', 'player8', 'player9'],
          matches: [
            {
              id: 'match13',
              competitionId: 'comp3',
              homePlayerId: 'player7',
              awayPlayerId: 'player8',
              homeScore: 2,
              awayScore: 3,
              status: 'completed',
              scheduledTime: new Date(oneWeekAgo.getTime() + 2 * 60 * 60 * 1000).toISOString(),
              completedAt: new Date(oneWeekAgo.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
            },
          ],
        },
      ],
    },
    {
      id: 'group3',
      name: 'TrashFoot Pro League',
      description: 'Elite professional players only 👑',
      adminId: 'player10',
      adminIds: ['player10'],
      members: [
        {
          id: 'player10',
          name: 'Carlos "Legend" Garcia',
          gamerHandle: 'legend_carlos',
          email: 'carlos@trashfoot.com',
          role: 'admin',
          status: 'active',
          joinedAt: threeWeeksAgo.toISOString(),
          stats: { played: 15, wins: 12, draws: 2, losses: 1, goalsFor: 45, goalsAgainst: 12, cleanSheets: 8, points: 38, winRate: 80, form: ['W', 'W', 'W', 'D', 'W'], leaguesWon: 2, knockoutsWon: 1 },
        },
        {
          id: 'player11',
          name: 'Sofia "Ace" Martinez',
          gamerHandle: 'ace_sofia',
          email: 'sofia@trashfoot.com',
          role: 'player',
          status: 'active',
          joinedAt: threeWeeksAgo.toISOString(),
          stats: { played: 14, wins: 10, draws: 3, losses: 1, goalsFor: 38, goalsAgainst: 15, cleanSheets: 6, points: 33, winRate: 71.4, form: ['W', 'D', 'W', 'W', 'W'], leaguesWon: 1, knockoutsWon: 2 },
        },
      ],
      createdAt: threeWeeksAgo.toISOString(),
      inviteCode: 'PROLEAG1',
      isPublic: true,
      pendingMembers: [],
      competitions: [
        {
          id: 'comp4',
          groupId: 'group3',
          name: 'Pro Championship',
          type: 'tournament',
          status: 'active',
          startDate: twoWeeksAgo.toISOString(),
          participants: ['player10', 'player11'],
          matches: [
            {
              id: 'match14',
              competitionId: 'comp4',
              homePlayerId: 'player10',
              awayPlayerId: 'player11',
              homeScore: 4,
              awayScore: 2,
              status: 'completed',
              scheduledTime: new Date(twoWeeksAgo.getTime() + 4 * 60 * 60 * 1000).toISOString(),
              completedAt: new Date(twoWeeksAgo.getTime() + 4.5 * 60 * 60 * 1000).toISOString(),
            },
          ],
        },
      ],
    },
  ];

  // Get the main group from createDummyData
  const mainData = createDummyData();
  const allGroups = [mainData.groups[0], ...additionalGroups];
  
  // Collect all users from all groups
  const allUsers: Player[] = [];
  const userIds = new Set<string>();
  
  allGroups.forEach(group => {
    group.members.forEach(member => {
      if (!userIds.has(member.id)) {
        userIds.add(member.id);
        allUsers.push(member);
      }
    });
  });

  // Calculate platform stats
  const allMatches = allGroups.flatMap(g => g.competitions.flatMap(c => c.matches));
  const allCompetitions = allGroups.flatMap(g => g.competitions);
  
  const platformStats: PlatformStats = {
    totalUsers: allUsers.length,
    totalGroups: allGroups.length,
    totalMatches: allMatches.length,
    totalCompetitions: allCompetitions.length,
    activeGroups: allGroups.filter(g => g.competitions.some(c => c.status === 'active')).length,
    completedMatches: allMatches.filter(m => m.status === 'completed').length,
    liveMatches: allMatches.filter(m => m.status === 'live').length,
    scheduledMatches: allMatches.filter(m => m.status === 'scheduled').length,
  };

  // Create recent activity
  const recentActivity = [
    {
      type: 'match_completed' as const,
      description: 'Carlos "Legend" Garcia defeated Sofia "Ace" Martinez 4-2',
      timestamp: new Date(twoWeeksAgo.getTime() + 4.5 * 60 * 60 * 1000).toISOString(),
      groupId: 'group3',
      userId: 'player10',
    },
    {
      type: 'group_created' as const,
      description: 'TrashFoot Rising Stars group was created',
      timestamp: oneWeekAgo.toISOString(),
      groupId: 'group2',
      userId: 'player7',
    },
    {
      type: 'user_joined' as const,
      description: 'Ryan "Flash" Miller joined TrashFoot Rising Stars',
      timestamp: oneWeekAgo.toISOString(),
      groupId: 'group2',
      userId: 'player8',
    },
    {
      type: 'competition_started' as const,
      description: 'Pro Championship tournament started',
      timestamp: twoWeeksAgo.toISOString(),
      groupId: 'group3',
    },
    {
      type: 'match_completed' as const,
      description: 'Ryan "Flash" Miller beat Emma "Rookie" Davis 3-2',
      timestamp: new Date(oneWeekAgo.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
      groupId: 'group2',
      userId: 'player8',
    },
  ];

  return {
    allGroups,
    allUsers,
    platformStats,
    recentActivity,
  };
}