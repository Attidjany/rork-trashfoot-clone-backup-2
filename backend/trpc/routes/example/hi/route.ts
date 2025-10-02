import { z } from "zod";
import { publicProcedure } from "../../../create-context";

export const hiProcedure = publicProcedure
  .input(z.object({ name: z.string().optional() }).optional())
  .query(({ input }) => {
    return {
      hello: input?.name || 'World',
      date: new Date(),
      message: 'Backend is working!'
    };
  });