import { createTRPCRouter } from "./create-context";
import { registerProcedure } from "./routes/auth/register/route";
import { loginProcedure } from "./routes/auth/login/route";
import { oauthLoginProcedure } from "./routes/auth/oauth-login/route";
import { checkGamerHandleProcedure } from "./routes/auth/check-handle/route";
import { saveUserDataProcedure } from "./routes/auth/save-data/route";
import { updateProfileProcedure } from "./routes/auth/update-profile/route";
import { getPublicGroupsProcedure, requestJoinGroupProcedure, manageGroupMemberProcedure, createGroupProcedure, joinGroupProcedure, getUserGroupsProcedure, getGroupDetailsProcedure } from "./routes/groups/management/route";
import { createCompetitionProcedure, getGroupCompetitionsProcedure } from "./routes/competitions/management/route";
import { updateMatchResultProcedure } from "./routes/matches/update-result/route";
import { correctMatchScoreProcedure } from "./routes/matches/correct-score/route";
import { deleteMatchProcedure } from "./routes/matches/delete/route";
import { getAllAccountsProcedure, deleteAccountProcedure, getAccountStatsProcedure, bulkDeleteAccountsProcedure } from "./routes/admin/accounts/route";
import { getAllGroupsProcedure, deleteGroupProcedure, removeUserFromGroupProcedure, deleteMatchProcedure as superadminDeleteMatchProcedure, correctMatchScoreProcedure as superadminCorrectMatchScoreProcedure, manageJoinRequestProcedure, deleteCompetitionProcedure, assignGroupAdminProcedure, deletePlayerProcedure, getAllMatchesProcedure, getAllCompetitionsProcedure, getAllPlayersProcedure, getPlatformStatsProcedure } from "./routes/admin/superadmin/route";

export const appRouter = createTRPCRouter({
  auth: createTRPCRouter({
    register: registerProcedure,
    login: loginProcedure,
    oauthLogin: oauthLoginProcedure,
    checkGamerHandle: checkGamerHandleProcedure,
    saveData: saveUserDataProcedure,
    updateProfile: updateProfileProcedure,
  }),
  groups: createTRPCRouter({
    getPublic: getPublicGroupsProcedure,
    requestJoin: requestJoinGroupProcedure,
    manageMember: manageGroupMemberProcedure,
    create: createGroupProcedure,
    join: joinGroupProcedure,
    getUserGroups: getUserGroupsProcedure,
    getDetails: getGroupDetailsProcedure,
  }),
  admin: createTRPCRouter({
    getAllAccounts: getAllAccountsProcedure,
    deleteAccount: deleteAccountProcedure,
    getAccountStats: getAccountStatsProcedure,
    bulkDeleteAccounts: bulkDeleteAccountsProcedure,
  }),
  superadmin: createTRPCRouter({
    getAllGroups: getAllGroupsProcedure,
    deleteGroup: deleteGroupProcedure,
    removeUserFromGroup: removeUserFromGroupProcedure,
    deleteMatch: superadminDeleteMatchProcedure,
    correctMatchScore: superadminCorrectMatchScoreProcedure,
    manageJoinRequest: manageJoinRequestProcedure,
    deleteCompetition: deleteCompetitionProcedure,
    assignGroupAdmin: assignGroupAdminProcedure,
    deletePlayer: deletePlayerProcedure,
    getAllMatches: getAllMatchesProcedure,
    getAllCompetitions: getAllCompetitionsProcedure,
    getAllPlayers: getAllPlayersProcedure,
    getPlatformStats: getPlatformStatsProcedure,
  }),
  competitions: createTRPCRouter({
    create: createCompetitionProcedure,
    getGroupCompetitions: getGroupCompetitionsProcedure,
  }),
  matches: createTRPCRouter({
    updateResult: updateMatchResultProcedure,
    correctScore: correctMatchScoreProcedure,
    delete: deleteMatchProcedure,
  }),
});

export type AppRouter = typeof appRouter;