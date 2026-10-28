export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  dashboard: (userId: string) => ['dashboard', userId] as const,
  wallet: (userId: string) => ['wallet', userId] as const,
  board: (userId: string, game: string, stage: number) => ['board', userId, game, stage] as const,
}
