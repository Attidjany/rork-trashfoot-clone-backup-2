// Simple in-memory storage for backend (in production, use a real database)
// Shared storage to ensure data consistency across routes

import { Player, Group, Competition, Match, ChatMessage } from '@/types/game';
import { createDummyData, createAdminDummyData } from '@/mocks/dummy-data';

// Storage for user data
export const userDataStorage = new Map<string, any>();

// Storage for real accounts (non-dummy)
export const realAccountsStorage = new Map<string, Player>();

// Storage for real groups created by users
export const realGroupsStorage = new Map<string, Group>();

// Storage for real matches and competitions
export const realMatchesStorage = new Map<string, Match>();
export const realCompetitionsStorage = new Map<string, Competition>();
export const realMessagesStorage = new Map<string, ChatMessage[]>();

// Track which accounts are dummy vs real
export const accountTypeStorage = new Map<string, 'dummy' | 'real'>();

// Initialize dummy data and mark as dummy accounts
function initializeDummyData() {
  const dummyData = createDummyData();
  const adminData = createAdminDummyData();
  
  // Mark all dummy accounts
  const allDummyUsers = [...adminData.allUsers];
  allDummyUsers.forEach(user => {
    if (user.email?.trim()) {
      accountTypeStorage.set(user.email, 'dummy');
    }
  });
  
  console.log('Initialized dummy data with', allDummyUsers.length, 'dummy accounts');
  
  return { dummyData, adminData };
}

// Initialize on startup
initializeDummyData();

// Helper functions
export function isDummyAccount(email: string): boolean {
  if (!email?.trim()) return false;
  return accountTypeStorage.get(email.trim()) === 'dummy';
}

export function isRealAccount(email: string): boolean {
  if (!email?.trim()) return false;
  return accountTypeStorage.get(email.trim()) === 'real';
}

export function getAllDummyAccounts(): Player[] {
  const adminData = createAdminDummyData();
  return adminData.allUsers;
}

export function getAllRealAccounts(): Player[] {
  return Array.from(realAccountsStorage.values());
}

export function getAllAccounts(): { dummy: Player[], real: Player[] } {
  return {
    dummy: getAllDummyAccounts(),
    real: getAllRealAccounts()
  };
}

export function createRealAccount(player: Player): void {
  if (!player.email?.trim()) {
    throw new Error('Invalid email for real account creation');
  }
  const email = player.email.trim();
  realAccountsStorage.set(email, player);
  accountTypeStorage.set(email, 'real');
  console.log('Created real account:', email);
}

export function deleteAccount(email: string): boolean {
  if (!email?.trim()) return false;
  const cleanEmail = email.trim();
  const accountType = accountTypeStorage.get(cleanEmail);
  
  if (accountType === 'real') {
    realAccountsStorage.delete(cleanEmail);
    accountTypeStorage.delete(cleanEmail);
    userDataStorage.delete(cleanEmail);
    console.log('Deleted real account:', cleanEmail);
    return true;
  } else if (accountType === 'dummy') {
    // For dummy accounts, we just remove them from the type tracking
    // The actual dummy data will be regenerated on next access
    accountTypeStorage.delete(cleanEmail);
    userDataStorage.delete(cleanEmail);
    console.log('Removed dummy account:', cleanEmail);
    return true;
  }
  
  return false;
}

export function getDummyDataForUser(email: string) {
  if (!email?.trim()) {
    throw new Error('Invalid email for dummy data retrieval');
  }
  // Always return fresh dummy data to ensure consistency
  return createDummyData();
}

export function getAdminDummyData() {
  return createAdminDummyData();
}