interface SongManagerI {
  add({ id, room, tags }: { id: string; room: string; tags: ChatUserstate }): Promise<void>;
  skip(room: string): void;
  play(room: string): void;
  pause(room: string): void;
  getCurrent(room: string): Promise<CurrentSong | null> | (CurrentSong | null);
  getPlaylist(room: string): Promise<Song[]> | Song[];
  isPaused(room: string): Promies<boolean> | boolean;
  playNextSong(room: string): void;
}
