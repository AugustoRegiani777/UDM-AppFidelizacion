export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  dashboard: (userId: string) => ['dashboard', userId] as const,
}
