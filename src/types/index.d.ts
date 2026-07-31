interface SongManagerI {
  add({ id, room, tags }: { id: string; room: string; tags: ChatUserstate }): Promise<void>;
  skip(room: string): Promise<void>;
  play(room: string): Promise<void>;
  pause(room: string): Promise<void>;
  getCurrent(room: string): Promise<CurrentSong | null> | (CurrentSong | null);
  getPlaylist(room: string): Promise<Song[]> | Song[];
  isPaused(room: string): Promise<boolean>;
  playNextSong(room: string): Promise<void>;
}
