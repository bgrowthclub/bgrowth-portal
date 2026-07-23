import { supabase } from "./supabaseClient";
import type { UserProfileRow } from "@/types/database";

export const userService = {
  async fetchProfile(userId: string): Promise<UserProfileRow | null> {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  },
};
