import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { userNotificationStates } from "@/lib/db/schema"

export async function POST() {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const now = new Date()

  const existing = await db.query.userNotificationStates.findFirst({
    where: eq(userNotificationStates.userId, userId),
    columns: { userId: true },
  })

  if (existing) {
    await db
      .update(userNotificationStates)
      .set({ borrowingLastReadAt: now, updatedAt: now })
      .where(eq(userNotificationStates.userId, userId))
  } else {
    await db.insert(userNotificationStates).values({
      userId,
      borrowingLastReadAt: now,
      updatedAt: now,
    })
  }

  return NextResponse.json({ ok: true, readAt: now.toISOString() })
}
