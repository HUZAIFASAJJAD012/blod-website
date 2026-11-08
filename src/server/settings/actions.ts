"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { guarded, fdBool, fdStr } from "@/server/admin/helpers";
import type { FormResult } from "@/components/admin/action-form";
import { audit } from "@/server/security/audit";
import { SETTINGS, SETTINGS_TAG, type SettingKey } from "./index";
import { MONETIZATION_FIELDS, SETTINGS_FORMS, parseFields } from "./fields";

async function persist(userId: string, key: SettingKey, value: Record<string, unknown>) {
  const existing = await db.siteSetting.findUnique({ where: { key } });
  const merged = { ...((existing?.valueJson as Record<string, unknown>) ?? {}), ...value };
  const parsed = SETTINGS[key].parse(merged);
  await db.siteSetting.upsert({
    where: { key },
    create: { key, valueJson: parsed as Prisma.InputJsonValue, updatedById: userId },
    update: { valueJson: parsed as Prisma.InputJsonValue, updatedById: userId },
  });
  await audit({ actorId: userId, action: "settings.update", entityType: "Setting", entityId: key, summary: { changed: Object.keys(value) } });
  revalidateTag(SETTINGS_TAG, "max");
  revalidatePath("/", "layout");
}

export async function saveSettingsAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("settings.manage", async (user) => {
    const key = fdStr(fd, "_key") as SettingKey;
    const form = SETTINGS_FORMS.find((f) => f.key === key);
    if (!form) throw Object.assign(new Error("Unknown settings group."), { status: 422 });
    await persist(user.id, key, parseFields(form.fields, fd));
    return `${form.title} settings saved.`;
  });
}

export async function saveMonetizationAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("monetization.manage", async (user) => {
    const values = parseFields(MONETIZATION_FIELDS, fd);
    const before = await db.siteSetting.findUnique({ where: { key: "monetization" } });
    const prevApproved = Boolean((before?.valueJson as { ownerConfirmedApproval?: boolean } | null)?.ownerConfirmedApproval);
    if (values.ownerConfirmedApproval && !prevApproved) values.ownerConfirmedApprovalAt = new Date().toISOString();
    if (!values.ownerConfirmedApproval) values.ownerConfirmedApprovalAt = null;
    await persist(user.id, "monetization", values);
    revalidatePath("/privacy-policy");
    return "Monetization settings saved.";
  });
}

export async function savePlacementAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("monetization.manage", async (user) => {
    const data = z
      .object({
        id: z.string(),
        adUnitId: z.string().regex(/^(\d{6,20})?$/, "Ad unit (data-ad-slot) IDs are digits only."),
        enabled: z.boolean(),
        minHeightDesktop: z.number().int().min(50).max(600),
        minHeightMobile: z.number().int().min(50).max(600),
        minContentThreshold: z.number().int().min(0).max(10000),
      })
      .parse({
        id: fdStr(fd, "id"),
        adUnitId: fdStr(fd, "adUnitId"),
        enabled: fdBool(fd, "enabled"),
        minHeightDesktop: Number(fdStr(fd, "minHeightDesktop")),
        minHeightMobile: Number(fdStr(fd, "minHeightMobile")),
        minContentThreshold: Number(fdStr(fd, "minContentThreshold")),
      });
    if (data.enabled && !data.adUnitId) throw Object.assign(new Error("Add the ad unit ID from AdSense before enabling this placement."), { status: 422 });
    await db.adPlacement.update({
      where: { id: data.id },
      data: { adUnitId: data.adUnitId || null, enabled: data.enabled, minContentThreshold: data.minContentThreshold, positions: { minHeightDesktop: data.minHeightDesktop, minHeightMobile: data.minHeightMobile, format: "auto" } },
    });
    await audit({ actorId: user.id, action: "ads.placement_update", entityType: "AdPlacement", entityId: data.id, summary: { enabled: data.enabled } });
    revalidatePath("/", "layout");
    return "Placement saved.";
  });
}
