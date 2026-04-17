export function getTeamClass(teamId: string | null | undefined, prefix: string): string | null {
  if (!teamId) {
    return null;
  }

  return `${prefix}${teamId.toLowerCase()}`;
}
