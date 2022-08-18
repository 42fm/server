export interface Song {
  id?: string;
  username?: string;
  yt_id?: string;
  title?: string;
  url: string;
  artist?: string;
  imgUrl?: string;
  duration: number;
}

export interface CurrentSong extends Song {
  durationRemaining: number;
  isPlaying: boolean;
}

export interface Channel {
  current: CurrentSong;
  list: Song[];
}

export interface IChannels {
  [key: string]: Channel;
}

export type Skip = SkipWithPlaylist | SkipWithNoPlaylist;

interface SkipWithPlaylist {
  type: "playlist";
  current: CurrentSong;
}

interface SkipWithNoPlaylist {
  type: "noplaylist";
}

export interface ServerToClientEvents {
  song: (data: Channel) => void;
  songUpdate: (data: Channel) => void;
  songSync: (data: number) => void;
  playlistUpdate: (data: Channel) => void;
  playlistAdd: (data: Song) => void;
  skip: (data: Skip) => void;
  pause: () => void;
  play: () => void;
  clear: () => void;
  no42fm: () => void;
  yes42fm: () => void;
  userCount: (data: number) => void;
}

export interface ClientToServerEvents {
  joinRoom: ({ room }: { room: string }) => void;
  sync: ({ room }: { room: string }) => void;
  couldNotLoad: (room: string) => void;
  // addSong: ({ url, room }: { url: string; room: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {}
