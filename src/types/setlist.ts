export type DayType = 1 | 2;

export type SetlistCard = {
  id: number;
  day: DayType;
  title: string;
  artist: string;
  imageSrc: string;
  isPosterDummy: boolean;
};
