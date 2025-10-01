import { createTRPCRouter } from "./create-context";
import { hiProcedure } from "./routes/example/hi/route";
import { registerProcedure } from "./routes/auth/register/route";
import { loginProcedure } from "./routes/auth/login/route";
import { checkGamerHandleProcedure } from "./routes/auth/check-handle/route";
import { saveUserDataProcedure } from "./routes/auth/save-data/route";
import { getPublicGroupsProcedure, requestJoinGroupProcedure, manageGroupMemberProcedure } from "./routes/groups/management/route";
import { getAllAccountsProcedure, deleteAccountProcedure, getAccountStatsProcedure, bulkDeleteAccountsProcedure } from "./routes/admin/accounts/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiProcedure,
  }),
  auth: createTRPCRouter({
    register: registerProcedure,
    login: loginProcedure,
    checkGamerHandle: checkGamerHandleProcedure,
    saveData: saveUserDataProcedure,
  }),
  groups: createTRPCRouter({
    getPublic: getPublicGroupsProcedure,
    requestJoin: requestJoinGroupProcedure,
    manageMember: manageGroupMemberProcedure,
  }),
  admin: createTRPCRouter({
    getAllAccounts: getAllAccountsProcedure,
    deleteAccount: deleteAccountProcedure,
    getAccountStats: getAccountStatsProcedure,
    bulkDeleteAccounts: bulkDeleteAccountsProcedure,
  }),
});

export type AppRouter = typeof appRouter;