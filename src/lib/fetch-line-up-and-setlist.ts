import { supabase } from "@/lib/supabase";

export type LineUpRow = Record<string, unknown> & {
  id?: number;
  day?: string | number;
  team?: string;
  team_name?: string;
  image_src?: string;
};

export type SetlistRow = Record<string, unknown> & {
  id?: number;
  day?: string | number;
  team?: string;
  team_name?: string;
  image_src?: string;
  title?: string;
  singer?: string;
  album?: string;
  youtube_url?: string;
};

const LINE_UP_TABLE_CANDIDATES = ["Line Up", "line_up", "LineUp", "lineup"];
const SETLIST_TABLE_CANDIDATES = ["Setlist", "setlist", "set_list"];

// 테이블명 표기가 프로젝트 히스토리상 여러 번 바뀌어서, 실제로 데이터가 있는 후보를 순서대로 시도한다.
export async function fetchLineUpRows(): Promise<LineUpRow[]> {
  for (const tableName of LINE_UP_TABLE_CANDIDATES) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("id", { ascending: true });

    if (error || !data || data.length === 0) continue;
    return data as LineUpRow[];
  }
  return [];
}

export async function fetchSetlistRows(): Promise<SetlistRow[]> {
  for (const tableName of SETLIST_TABLE_CANDIDATES) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("id", { ascending: true });

    if (error || !data || data.length === 0) continue;
    return data as SetlistRow[];
  }
  return [];
}
