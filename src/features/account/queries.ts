import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { AccountService, type AccountOverview } from "@/features/account/account-service";
import { PrismaAccountRepository } from "@/features/account/prisma-account-repository";
import { createNotificationService } from "@/features/notifications/notification-service";
import { prismaNotificationRepository } from "@/features/notifications/prisma-notification-repository";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const accountRepository = new PrismaAccountRepository(prisma);
const accountService = new AccountService(accountRepository);
const notificationService = createNotificationService({ repo: prismaNotificationRepository });

export const getAccountData = cache(async (): Promise<AccountOverview> => {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/auth");
  }

  const [overview, notificationPreferences] = await Promise.all([
    accountService.getAccountOverview(session.user.id, session.session?.token),
    notificationService.getPreferences(session.user.id),
  ]);
  return { ...overview, notificationPreferences };
});
