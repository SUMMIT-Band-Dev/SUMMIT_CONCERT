// 공연 일차. Line Up.day가 `dayN` 형식이면 N을 그대로 쓴다(서버가 day3 이상도 허용한다).
export type DayType = number;

export type SetlistCard = {
  id: number;
  day: DayType;
  title: string;
  artist: string;
  imageSrc: string;
  isPosterDummy: boolean;
};

export type TrackItem = {
  id: number;
  title: string;
  artist: string;
  coverShape: "square" | "image";
  coverSrc?: string;
  youtubeUrl?: string;
};

export type TeamPlaylist = {
  teamName: string;
  tracks: TrackItem[];
};
