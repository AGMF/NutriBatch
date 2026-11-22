import { createClient } from "supabase";

const SUPABASE_URL = "https://ecwvgqzzmxnngfhjlejk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_1uOWx-SNjBrH1ZZSexaLUA_INC5yBQc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
